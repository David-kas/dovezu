import { prisma } from "../prisma";
import type { MatchConfidence, Prisma, DocumentStatus, PaymentMethod } from "@prisma/client";
import { processReceiptFile, type OcrLineItem, type OcrReceiptResult } from "./receipt-ocr.service";
import { saveReceiptFileSafe, normalizeMimeType } from "./receipt-storage.service";
import { findProductByAlias, normalizeReceiptText, saveAlias } from "./receipt-matching.service";
import { sumDocumentLines, checkReceiptDiscrepancy } from "./costing.service";
import { logActivity } from "./audit.service";
import type { Role } from "@prisma/client";
import { lookupBarcode } from "./barcode.service";

export interface MatchResult {
  receiptText: string;
  productId?: string;
  productName?: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  confidence: MatchConfidence;
  candidates?: { id: string; name: string }[];
}

async function recalcDocumentTotals(documentId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  const lines = await db.stockDocumentLine.findMany({
    where: { documentId, excluded: false },
  });
  const total = sumDocumentLines(lines);
  await db.stockDocument.update({
    where: { id: documentId },
    data: { linesTotal: total },
  });
  return total;
}

async function findOrCreateSupplierByOcr(ocr: OcrReceiptResult) {
  if (ocr.inn) {
    const byInn = await prisma.supplier.findFirst({ where: { inn: ocr.inn, isActive: true } });
    if (byInn) return byInn;
  }
  if (ocr.storeName) {
    const byName = await prisma.supplier.findFirst({
      where: { name: { equals: ocr.storeName, mode: "insensitive" }, isActive: true },
    });
    if (byName) return byName;
    return prisma.supplier.create({
      data: { name: ocr.storeName, inn: ocr.inn ?? undefined, legalName: ocr.storeName },
    });
  }
  return null;
}

export async function matchOcrLine(
  item: OcrLineItem,
  supplierId?: string
): Promise<MatchResult> {
  if (item.barcode) {
    const bc = await lookupBarcode(item.barcode);
    if (bc?.product) {
      return {
        receiptText: item.name,
        productId: bc.product.id,
        productName: bc.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        confidence: "EXACT",
      };
    }
  }

  const match = await findProductByAlias(item.name, supplierId);
  if ("product" in match && match.product) {
    return {
      receiptText: item.name,
      productId: match.product.id,
      productName: match.product.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      confidence: match.confidence === "EXACT" ? "EXACT" : "PROBABLE",
    };
  }
  if ("products" in match && match.products) {
    return {
      receiptText: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      confidence: "PROBABLE",
      candidates: match.products.map((p) => ({ id: p.id, name: p.name })),
    };
  }

  return {
    receiptText: item.name,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal,
    confidence: "UNMATCHED",
  };
}

export async function uploadAndProcessReceipt(
  documentId: string,
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  userId: string,
  userRole: Role,
  pageNumber?: number
) {
  const doc = await prisma.stockDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Документ не найден");
  if (doc.status === "POSTED" || doc.status === "CANCELLED") {
    throw new Error("Документ нельзя изменить");
  }

  const normalizedMime = normalizeMimeType(mimeType, fileName);

  const { fileUrl, fileName: savedName } = await saveReceiptFileSafe(
    documentId,
    fileBuffer,
    fileName,
    normalizedMime
  );

  const ocr = await processReceiptFile(fileBuffer, normalizedMime);

  return prisma.$transaction(async (tx) => {
    const docLocked = await tx.stockDocument.findUnique({ where: { id: documentId } });
    if (!docLocked) throw new Error("Документ не найден");
    if (docLocked.status === "POSTED" || docLocked.status === "CANCELLED") {
      throw new Error("Документ нельзя изменить");
    }

    await tx.documentAttachment.create({
      data: {
        documentId,
        fileName: savedName,
        fileUrl,
        mimeType: normalizedMime,
        pageNumber: pageNumber ?? 1,
      },
    });

    await tx.receiptOcrResult.create({
      data: {
        documentId,
        rawJson: ocr.rawJson,
        storeName: ocr.storeName,
        inn: ocr.inn,
        receiptDate: ocr.receiptDate ? new Date(ocr.receiptDate) : null,
        receiptTime: ocr.receiptTime,
        receiptNumber: ocr.receiptNumber,
        totalAmount: ocr.totalAmount,
        discount: ocr.discount,
      },
    });

    let supplierId = docLocked.supplierId;
    const supplier = await findOrCreateSupplierByOcr(ocr);
    if (supplier) supplierId = supplier.id;

    const updateData: Prisma.StockDocumentUpdateInput = {};
    if (supplierId) updateData.supplier = { connect: { id: supplierId } };
    if (ocr.receiptNumber) updateData.receiptNumber = ocr.receiptNumber;
    if (ocr.totalAmount != null) updateData.receiptTotal = ocr.totalAmount;
    if (ocr.receiptDate) updateData.purchaseDate = new Date(ocr.receiptDate);

    if (Object.keys(updateData).length > 0) {
      await tx.stockDocument.update({ where: { id: documentId }, data: updateData });
    }

    const matchedLines: MatchResult[] = [];
    for (const item of ocr.lines) {
      const match = await matchOcrLine(item, supplierId ?? undefined);
      matchedLines.push(match);

      await tx.stockDocumentLine.create({
        data: {
          documentId,
          productId: match.productId,
          quantity: match.quantity,
          purchasePrice: match.unitPrice,
          lineTotal: match.lineTotal,
          receiptLineText: match.receiptText,
          matchConfidence: match.confidence,
        },
      });
    }

    await recalcDocumentTotals(documentId, tx);

    await tx.documentChangeLog.create({
      data: {
        documentId,
        userId,
        action: "RECEIPT_UPLOADED",
        newValue: JSON.stringify({ fileName: savedName, lines: ocr.lines.length }),
      },
    });

    await logActivity({
      userId,
      userRole,
      action: "RECEIPT_UPLOADED",
      entityType: "StockDocument",
      entityId: documentId,
      newValue: JSON.stringify({ fileName: savedName }),
      tx,
    });

    return {
      attachment: { fileUrl, fileName: savedName },
      ocr: {
        storeName: ocr.storeName,
        inn: ocr.inn,
        receiptNumber: ocr.receiptNumber,
        totalAmount: ocr.totalAmount,
        linesCount: ocr.lines.length,
      },
      matchedLines,
      supplierId,
    };
  });
}

export async function matchLineToProduct(
  lineId: string,
  productId: string,
  userId: string,
  userRole: Role,
  options?: { saveAlias?: boolean; supplierId?: string }
) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.stockDocumentLine.findUnique({
      where: { id: lineId },
      include: { document: true },
    });
    if (!line) throw new Error("Строка не найдена");
    if (line.document.status === "POSTED") throw new Error("Документ проведён");

    const updated = await tx.stockDocumentLine.update({
      where: { id: lineId },
      data: {
        productId,
        matchConfidence: "EXACT",
        excluded: false,
      },
      include: { product: true },
    });

    if (options?.saveAlias !== false && line.receiptLineText) {
      await saveAlias({
        receiptText: line.receiptLineText,
        productId,
        supplierId: options?.supplierId ?? line.document.supplierId ?? undefined,
        confirmedById: userId,
      });
    }

    await recalcDocumentTotals(line.documentId, tx);

    await logActivity({
      userId,
      userRole,
      action: "RECEIPT_LINE_MATCHED",
      entityType: "StockDocumentLine",
      entityId: lineId,
      newValue: JSON.stringify({ productId, text: line.receiptLineText }),
      tx,
    });

    return updated;
  });
}

export async function excludeLine(lineId: string, userId: string, userRole: Role) {
  return prisma.$transaction(async (tx) => {
    const line = await tx.stockDocumentLine.findUnique({
      where: { id: lineId },
      include: { document: true },
    });
    if (!line) throw new Error("Строка не найдена");
    if (line.document.status === "POSTED") throw new Error("Документ проведён");

    const updated = await tx.stockDocumentLine.update({
      where: { id: lineId },
      data: { excluded: true, productId: null },
    });

    await recalcDocumentTotals(line.documentId, tx);

    await logActivity({
      userId,
      userRole,
      action: "RECEIPT_LINE_EXCLUDED",
      entityType: "StockDocumentLine",
      entityId: lineId,
      tx,
    });

    return updated;
  });
}

export async function updateDocumentMeta(
  documentId: string,
  data: {
    supplierId?: string;
    receiptTotal?: number;
    receiptNumber?: string;
    paymentMethod?: "CASH" | "CARD" | "TRANSFER" | "OTHER";
    comment?: string;
  }
) {
  return prisma.stockDocument.update({
    where: { id: documentId },
    data: {
      supplierId: data.supplierId,
      receiptTotal: data.receiptTotal,
      receiptNumber: data.receiptNumber,
      paymentMethod: data.paymentMethod,
      comment: data.comment,
    },
  });
}

export async function getDocumentReviewState(documentId: string) {
  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: {
      supplier: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
      attachments: true,
      ocrResults: { orderBy: { processedAt: "desc" }, take: 1 },
    },
  });
  if (!doc) throw new Error("Документ не найден");

  const activeLines = doc.lines.filter((l) => !l.excluded);
  const linesTotal = sumDocumentLines(doc.lines);
  const discrepancy = checkReceiptDiscrepancy(
    doc.receiptTotal ? Number(doc.receiptTotal) : null,
    linesTotal,
    doc.totalPurchaseCost ? Number(doc.totalPurchaseCost) : null
  );

  const unmatched = doc.lines.filter((l) => !l.excluded && !l.productId);
  const probable = doc.lines.filter((l) => !l.excluded && l.matchConfidence === "PROBABLE" && l.productId);
  const exact = doc.lines.filter((l) => !l.excluded && l.matchConfidence === "EXACT" && l.productId);

  const canSubmit = unmatched.length === 0 && activeLines.length > 0;

  return {
    document: doc,
    summary: {
      linesTotal,
      receiptTotal: doc.receiptTotal ? Number(doc.receiptTotal) : null,
      discrepancy,
      counts: { exact: exact.length, probable: probable.length, unmatched: unmatched.length, excluded: doc.lines.filter((l) => l.excluded).length },
      canSubmit,
    },
  };
}

export { recalcDocumentTotals };

// ─── Document CRUD (from phase 1) ───────────────────────────────────────────

export interface CreateReceiptInput {
  authorId: string;
  authorRole: Role;
  purchaserId?: string;
  supplierId?: string;
  toWarehouseId: string;
  purchaseDate?: Date;
  paymentMethod?: PaymentMethod;
  receiptNumber?: string;
  receiptTotal?: number;
  comment?: string;
  status?: DocumentStatus;
  lines?: {
    productId?: string;
    quantity: number;
    purchasePrice?: number;
    receiptLineText?: string;
  }[];
  meta?: { ipAddress?: string; userAgent?: string };
}

export async function createReceiptDocument(input: CreateReceiptInput) {
  const status = input.status ?? (input.authorRole === "PURCHASER" ? "REVIEW" : "DRAFT");

  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.create({
      data: {
        type: "RECEIPT",
        status,
        authorId: input.authorId,
        purchaserId: input.purchaserId ?? (input.authorRole === "PURCHASER" ? input.authorId : null),
        supplierId: input.supplierId,
        toWarehouseId: input.toWarehouseId,
        purchaseDate: input.purchaseDate ?? new Date(),
        paymentMethod: input.paymentMethod,
        receiptNumber: input.receiptNumber,
        receiptTotal: input.receiptTotal,
        comment: input.comment,
        lines: input.lines?.length
          ? {
              create: input.lines.map((l) => ({
                productId: l.productId,
                quantity: l.quantity,
                purchasePrice: l.purchasePrice,
                lineTotal: l.purchasePrice != null ? l.quantity * l.purchasePrice : undefined,
                receiptLineText: l.receiptLineText,
                matchConfidence: l.productId ? ("EXACT" as MatchConfidence) : ("UNMATCHED" as MatchConfidence),
              })),
            }
          : undefined,
      },
      include: { lines: true, supplier: true },
    });

    if (doc.lines.length) await recalcDocumentTotals(doc.id, tx);

    await tx.documentChangeLog.create({
      data: { documentId: doc.id, userId: input.authorId, action: "CREATED", newValue: JSON.stringify({ type: "RECEIPT", status }) },
    });

    await logActivity({
      userId: input.authorId,
      userRole: input.authorRole,
      action: "DOCUMENT_CREATED",
      entityType: "StockDocument",
      entityId: doc.id,
      newValue: JSON.stringify({ type: "RECEIPT", number: doc.number }),
      ipAddress: input.meta?.ipAddress,
      userAgent: input.meta?.userAgent,
      tx,
    });

    return doc;
  });
}

export async function addDocumentLine(
  documentId: string,
  userId: string,
  userRole: Role,
  line: { productId?: string; quantity: number; purchasePrice?: number; receiptLineText?: string },
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const doc = await db.stockDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Документ не найден");
  if (doc.status === "POSTED") throw new Error("Нельзя изменять проведённый документ");
  if (doc.status === "CANCELLED") throw new Error("Документ отменён");

  if (line.productId) {
    const existing = await db.stockDocumentLine.findFirst({
      where: { documentId, productId: line.productId, excluded: false },
    });
    if (existing) {
      const updated = await db.stockDocumentLine.update({
        where: { id: existing.id },
        data: {
          quantity: existing.quantity + line.quantity,
          lineTotal: line.purchasePrice != null ? (existing.quantity + line.quantity) * line.purchasePrice : undefined,
        },
      });
      await recalcDocumentTotals(documentId, db);
      return updated;
    }
  }

  const created = await db.stockDocumentLine.create({
    data: {
      documentId,
      productId: line.productId,
      quantity: line.quantity,
      purchasePrice: line.purchasePrice,
      lineTotal: line.purchasePrice != null ? line.quantity * line.purchasePrice : undefined,
      receiptLineText: line.receiptLineText,
      matchConfidence: line.productId ? "EXACT" : "UNMATCHED",
    },
  });

  await recalcDocumentTotals(documentId, db);

  await logActivity({
    userId,
    userRole,
    action: "DOCUMENT_LINE_ADDED",
    entityType: "StockDocument",
    entityId: documentId,
    newValue: JSON.stringify(created),
  });

  return created;
}

export async function submitForReview(documentId: string, userId: string, userRole: Role) {
  const state = await getDocumentReviewState(documentId);
  if (state.document.status !== "DRAFT") {
    throw new Error("Отправить на проверку можно только черновик");
  }
  if (!state.summary.canSubmit) {
    throw new Error("Привяжите все строки к товарам или исключите их");
  }

  const updated = await prisma.stockDocument.update({
    where: { id: documentId },
    data: { status: "REVIEW" },
  });

  await logActivity({
    userId,
    userRole,
    action: "DOCUMENT_SUBMITTED_REVIEW",
    entityType: "StockDocument",
    entityId: documentId,
  });

  return updated;
}
