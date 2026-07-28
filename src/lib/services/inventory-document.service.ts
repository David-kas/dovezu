import { prisma } from "../prisma";
import type { Role } from "@prisma/client";
import { getStockQuantity } from "./inventory.service";
import { logActivity } from "./audit.service";
import { decimalToNumber } from "../utils";

async function assertInventoryEditable(documentId: string) {
  const doc = await prisma.stockDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Документ не найден");
  if (doc.type !== "INVENTORY") throw new Error("Документ не является инвентаризацией");
  if (doc.status !== "DRAFT") throw new Error("Документ нельзя изменить");
  if (!doc.toWarehouseId) throw new Error("Не указан склад");
  return doc;
}

export async function createInventoryDocument(input: {
  authorId: string;
  authorRole: Role;
  warehouseId: string;
  comment?: string;
  meta?: { ipAddress?: string; userAgent?: string };
}) {
  const warehouse = await prisma.warehouse.findFirst({
    where: { id: input.warehouseId, isActive: true },
  });
  if (!warehouse) throw new Error("Склад не найден");

  const doc = await prisma.stockDocument.create({
    data: {
      type: "INVENTORY",
      status: "DRAFT",
      authorId: input.authorId,
      toWarehouseId: input.warehouseId,
      comment: input.comment,
    },
    include: { toWarehouse: true },
  });

  await logActivity({
    userId: input.authorId,
    userRole: input.authorRole,
    action: "INVENTORY_CREATED",
    entityType: "StockDocument",
    entityId: doc.id,
    newValue: JSON.stringify({ number: doc.number, warehouseId: input.warehouseId }),
    ipAddress: input.meta?.ipAddress,
    userAgent: input.meta?.userAgent,
  });

  return doc;
}

export async function fillInventoryFromWarehouse(documentId: string) {
  const doc = await assertInventoryEditable(documentId);
  const warehouseId = doc.toWarehouseId!;

  const stocks = await prisma.warehouseStock.findMany({
    where: { warehouseId, quantity: { gt: 0 } },
    include: { product: { select: { id: true, name: true, status: true } } },
  });

  const existingLines = await prisma.stockDocumentLine.findMany({
    where: { documentId, excluded: false },
    select: { productId: true },
  });
  const existingProductIds = new Set(existingLines.map((l) => l.productId).filter(Boolean));

  let added = 0;
  for (const stock of stocks) {
    if (stock.product.status !== "ACTIVE") continue;
    if (existingProductIds.has(stock.productId)) continue;

    const book = stock.quantity;
    await prisma.stockDocumentLine.create({
      data: {
        documentId,
        productId: stock.productId,
        quantity: book,
        receiptLineText: JSON.stringify({ book }),
      },
    });
    added++;
  }

  return { added, total: stocks.length };
}

export async function upsertInventoryLine(
  documentId: string,
  productId: string,
  quantity: number
) {
  const doc = await assertInventoryEditable(documentId);
  if (quantity < 0) throw new Error("Количество не может быть отрицательным");

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Товар не найден");

  const book = await getStockQuantity(doc.toWarehouseId!, productId);
  const meta = JSON.stringify({ book });

  const existing = await prisma.stockDocumentLine.findFirst({
    where: { documentId, productId, excluded: false },
  });

  if (existing) {
    return prisma.stockDocumentLine.update({
      where: { id: existing.id },
      data: { quantity, receiptLineText: meta },
      include: { product: true },
    });
  }

  return prisma.stockDocumentLine.create({
    data: {
      documentId,
      productId,
      quantity,
      receiptLineText: meta,
    },
    include: { product: true },
  });
}

export async function incrementInventoryLine(documentId: string, productId: string, delta = 1) {
  const doc = await assertInventoryEditable(documentId);

  const existing = await prisma.stockDocumentLine.findFirst({
    where: { documentId, productId, excluded: false },
  });

  if (existing) {
    return upsertInventoryLine(documentId, productId, existing.quantity + delta);
  }

  const book = await getStockQuantity(doc.toWarehouseId!, productId);
  const startQty = Math.max(0, book) + delta;
  return upsertInventoryLine(documentId, productId, startQty);
}

export async function getInventoryState(documentId: string) {
  const doc = await prisma.stockDocument.findUnique({
    where: { id: documentId },
    include: {
      toWarehouse: true,
      author: { select: { name: true } },
      postedBy: { select: { name: true } },
      lines: {
        where: { excluded: false },
        include: { product: true },
        orderBy: { id: "asc" },
      },
    },
  });

  if (!doc || doc.type !== "INVENTORY") throw new Error("Документ не найден");

  const warehouseId = doc.toWarehouseId;
  const lines = await Promise.all(
    doc.lines.map(async (line) => {
      let book = 0;
      if (line.receiptLineText) {
        try {
          const parsed = JSON.parse(line.receiptLineText);
          book = parsed.book ?? parsed.bookQuantity ?? 0;
        } catch {
          book = parseInt(line.receiptLineText, 10) || 0;
        }
      }
      if (doc.status === "DRAFT" && warehouseId && line.productId) {
        book = await getStockQuantity(warehouseId, line.productId);
      } else if (line.receiptLineText) {
        try {
          book = JSON.parse(line.receiptLineText).book ?? book;
        } catch {
          /* keep */
        }
      }

      const fact = line.quantity;
      const delta = fact - book;

      return {
        id: line.id,
        productId: line.productId,
        productName: line.product?.name ?? "—",
        book,
        fact,
        delta,
        purchasePrice: line.purchasePrice ? decimalToNumber(line.purchasePrice) : null,
      };
    })
  );

  const summary = {
    totalLines: lines.length,
    matched: lines.filter((l) => l.delta === 0).length,
    surplus: lines.filter((l) => l.delta > 0).length,
    shortage: lines.filter((l) => l.delta < 0).length,
    totalDelta: lines.reduce((s, l) => s + Math.abs(l.delta), 0),
  };

  return { document: doc, lines, summary };
}

export async function removeInventoryLine(documentId: string, lineId: string) {
  await assertInventoryEditable(documentId);
  await prisma.stockDocumentLine.delete({ where: { id: lineId, documentId } });
  return { deleted: true };
}
