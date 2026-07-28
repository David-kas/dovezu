import { prisma } from "../prisma";
import type { DocumentStatus, DocumentType, PaymentMethod, Prisma } from "@prisma/client";
import { sumDocumentLines } from "./costing.service";
import { logActivity } from "./audit.service";
import type { Role } from "@prisma/client";

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
                matchConfidence: l.productId ? "EXACT" : "UNMATCHED",
              })),
            }
          : undefined,
      },
      include: { lines: true, supplier: true },
    });

    if (doc.lines.length) {
      const total = sumDocumentLines(doc.lines);
      await tx.stockDocument.update({
        where: { id: doc.id },
        data: { linesTotal: total },
      });
    }

    await tx.documentChangeLog.create({
      data: {
        documentId: doc.id,
        userId: input.authorId,
        action: "CREATED",
        newValue: JSON.stringify({ type: "RECEIPT", status }),
      },
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
  line: {
    productId?: string;
    quantity: number;
    purchasePrice?: number;
    receiptLineText?: string;
  },
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
          lineTotal:
            line.purchasePrice != null
              ? (existing.quantity + line.quantity) * line.purchasePrice
              : undefined,
        },
      });
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
  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: { lines: { where: { excluded: false } } },
  });
  if (!doc) throw new Error("Документ не найден");
  if (doc.status !== "DRAFT") throw new Error("Отправить на проверку можно только черновик");
  if (doc.lines.length === 0) throw new Error("Добавьте позиции в документ");

  const unmatched = doc.lines.filter((l) => !l.productId && !l.excluded);
  if (unmatched.length > 0) {
    throw new Error("Привяжите все строки к товарам или исключите их");
  }

  return prisma.stockDocument.update({
    where: { id: documentId },
    data: { status: "REVIEW" },
  });
}
