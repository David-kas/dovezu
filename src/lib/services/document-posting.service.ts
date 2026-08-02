import { prisma } from "../prisma";
import type { DocumentType, MovementType, Prisma, Role } from "@prisma/client";
import { applyStockDelta, getCentralWarehouse, getStockQuantity, alignCentralWarehouseStock, resolveCentralWarehouseId } from "./inventory.service";
import { calcWeightedAvgPrice, sumDocumentLines, checkReceiptDiscrepancy } from "./costing.service";
import { logActivity } from "./audit.service";
import { decimalToNumber } from "../utils";

const DOC_TO_MOVEMENT: Record<DocumentType, MovementType> = {
  RECEIPT: "DOCUMENT_RECEIPT",
  TRANSFER: "DOCUMENT_TRANSFER",
  RETURN: "DOCUMENT_RETURN",
  WRITE_OFF: "DOCUMENT_WRITE_OFF",
  SALE: "DOCUMENT_SALE",
  INVENTORY: "DOCUMENT_INVENTORY",
  ADJUSTMENT: "DOCUMENT_ADJUSTMENT",
};

export async function getDocumentForPosting(documentId: string, tx: Prisma.TransactionClient) {
  const doc = await tx.stockDocument.findUnique({
    where: { id: documentId },
    include: { lines: { where: { excluded: false } }, supplier: true },
  });
  if (!doc) throw new Error("Документ не найден");
  if (doc.status === "POSTED") throw new Error("Документ уже проведён");
  if (doc.status === "CANCELLED") throw new Error("Документ отменён");
  return doc;
}

function validateLines(
  lines: { productId: string | null; quantity: number; purchasePrice: unknown; excluded: boolean }[],
  docType?: DocumentType
) {
  const active = lines.filter((l) => !l.excluded);
  if (active.length === 0) throw new Error("Нельзя провести пустой документ");
  for (const line of active) {
    if (!line.productId) throw new Error("У всех позиций должен быть выбран товар");
    if (docType === "INVENTORY") {
      if (line.quantity < 0) throw new Error("Количество не может быть отрицательным");
    } else if (line.quantity <= 0) {
      throw new Error("Количество должно быть больше нуля");
    }
    const price = line.purchasePrice != null ? decimalToNumber(line.purchasePrice as never) : null;
    if (price != null && price < 0) throw new Error("Закупочная цена не может быть отрицательной");
  }
}

async function checkDuplicateReceipt(
  supplierId: string | null,
  receiptNumber: string | null,
  documentId: string,
  tx: Prisma.TransactionClient
) {
  if (!supplierId || !receiptNumber) return;
  const dup = await tx.stockDocument.findFirst({
    where: {
      supplierId,
      receiptNumber,
      status: "POSTED",
      id: { not: documentId },
    },
  });
  if (dup) throw new Error("Документ с таким номером чека у этого поставщика уже проведён");
}

export async function postDocument(
  documentId: string,
  postedById: string,
  postedByRole: Role,
  meta?: { ipAddress?: string; userAgent?: string; discrepancyReason?: string }
) {
  return prisma.$transaction(async (tx) =>
    postDocumentInTransaction(tx, documentId, postedById, postedByRole, meta)
  );
}

export async function postDocumentInTransaction(
  tx: Prisma.TransactionClient,
  documentId: string,
  postedById: string,
  postedByRole: Role,
  meta?: { ipAddress?: string; userAgent?: string; discrepancyReason?: string }
) {
    const doc = await getDocumentForPosting(documentId, tx);
    validateLines(doc.lines, doc.type);

    if (doc.type === "RECEIPT") {
      await checkDuplicateReceipt(doc.supplierId, doc.receiptNumber, doc.id, tx);
      const linesTotal = sumDocumentLines(doc.lines);
      const check = checkReceiptDiscrepancy(
        doc.receiptTotal ? decimalToNumber(doc.receiptTotal) : null,
        linesTotal,
        doc.totalPurchaseCost ? decimalToNumber(doc.totalPurchaseCost) : null
      );
      if (check.hasDiscrepancy && !meta?.discrepancyReason && !doc.discrepancyReason) {
        throw new Error(check.message ?? "Расхождение суммы. Укажите причину.");
      }
      if (!doc.toWarehouseId) throw new Error("Не указан склад поступления");
    }

    if (doc.type === "INVENTORY" && !doc.toWarehouseId) {
      throw new Error("Не указан склад инвентаризации");
    }

    if (doc.type === "TRANSFER" && (!doc.fromWarehouseId || !doc.toWarehouseId)) {
      throw new Error("Укажите склад-источник и склад-получатель");
    }

    if (doc.type === "RETURN" && (!doc.fromWarehouseId || !doc.toWarehouseId)) {
      throw new Error("Укажите склад-источник и склад-получатель");
    }

    if ((doc.type === "SALE" || doc.type === "WRITE_OFF") && !doc.fromWarehouseId) {
      throw new Error("Не указан склад списания");
    }

    const movementType = DOC_TO_MOVEMENT[doc.type];

    let fromWarehouseId = doc.fromWarehouseId;
    if (fromWarehouseId && doc.type === "TRANSFER") {
      fromWarehouseId = await resolveCentralWarehouseId(fromWarehouseId, tx);
      if (fromWarehouseId !== doc.fromWarehouseId) {
        await tx.stockDocument.update({
          where: { id: documentId },
          data: { fromWarehouseId },
        });
        doc.fromWarehouseId = fromWarehouseId;
      }
    }

    for (const line of doc.lines) {
      if (!line.productId || line.excluded) continue;
      const productId = line.productId;
      const qty = line.quantity;
      const unitPrice = line.purchasePrice != null ? decimalToNumber(line.purchasePrice) : 0;

      switch (doc.type) {
        case "RECEIPT": {
          const whId = doc.toWarehouseId!;
          await applyStockDelta(whId, productId, qty, tx);

          const product = await tx.product.findUnique({ where: { id: productId } });
          if (!product) throw new Error("Товар не найден");

          const oldQty = await getStockQuantity(whId, productId, tx);
          const oldAvg = decimalToNumber(product.avgPurchasePrice || product.purchasePrice);
          const newAvg = calcWeightedAvgPrice(Math.max(0, oldQty - qty), oldAvg, qty, unitPrice);

          await tx.product.update({
            where: { id: productId },
            data: {
              purchasePrice: unitPrice,
              avgPurchasePrice: newAvg,
              lastSupplierId: doc.supplierId,
            },
          });

          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: qty,
              documentId: doc.id,
              warehouseId: whId,
              createdById: postedById,
              note: `Оприходование #${doc.number}`,
            },
          });
          break;
        }
        case "TRANSFER": {
          await alignCentralWarehouseStock(doc.fromWarehouseId!, productId, tx);
          const available = await getStockQuantity(doc.fromWarehouseId!, productId, tx);
          if (available < qty) {
            const p = await tx.product.findUnique({
              where: { id: productId },
              select: { name: true, centralStock: true },
            });
            throw new Error(
              `Недостаточно «${p?.name ?? "товара"}» на центральном складе (учёт: ${available} шт., в карточке: ${p?.centralStock ?? 0}). Обновите страницу и повторите.`
            );
          }

          await applyStockDelta(doc.fromWarehouseId!, productId, -qty, tx);
          await applyStockDelta(doc.toWarehouseId!, productId, qty, tx);

          const toWh = await tx.warehouse.findUnique({ where: { id: doc.toWarehouseId! } });
          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: qty,
              documentId: doc.id,
              warehouseId: doc.toWarehouseId,
              toCourierId: toWh?.courierId,
              createdById: postedById,
              note: `Перемещение #${doc.number}`,
            },
          });
          break;
        }
        case "RETURN": {
          const available = await getStockQuantity(doc.fromWarehouseId!, productId, tx);
          if (available < qty) throw new Error(`Недостаточно товара на складе-источнике`);

          await applyStockDelta(doc.fromWarehouseId!, productId, -qty, tx);
          await applyStockDelta(doc.toWarehouseId!, productId, qty, tx);

          const fromWh = await tx.warehouse.findUnique({ where: { id: doc.fromWarehouseId! } });
          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: qty,
              documentId: doc.id,
              warehouseId: doc.toWarehouseId,
              fromCourierId: fromWh?.courierId,
              createdById: postedById,
              note: `Возврат #${doc.number}`,
            },
          });
          break;
        }
        case "SALE": {
          const available = await getStockQuantity(doc.fromWarehouseId!, productId, tx);
          if (available < qty) throw new Error("Недостаточно товара на складе курьера");

          await applyStockDelta(doc.fromWarehouseId!, productId, -qty, tx);

          const fromWh = await tx.warehouse.findUnique({ where: { id: doc.fromWarehouseId! } });
          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: qty,
              documentId: doc.id,
              warehouseId: doc.fromWarehouseId,
              orderId: doc.orderId,
              fromCourierId: fromWh?.courierId,
              createdById: postedById,
              note: doc.orderId
                ? `Продажа #${doc.number}`
                : `Списание продажи #${doc.number}`,
            },
          });
          break;
        }
        case "WRITE_OFF": {
          if (!doc.fromWarehouseId) throw new Error("Не указан склад списания");
          await applyStockDelta(doc.fromWarehouseId, productId, -qty, tx);
          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: qty,
              documentId: doc.id,
              warehouseId: doc.fromWarehouseId,
              createdById: postedById,
              note: `Списание #${doc.number}`,
            },
          });
          break;
        }
        case "INVENTORY": {
          if (!doc.toWarehouseId) throw new Error("Не указан склад инвентаризации");
          const current = await getStockQuantity(doc.toWarehouseId, productId, tx);
          const delta = qty - current;
          await tx.stockDocumentLine.update({
            where: { id: line.id },
            data: { receiptLineText: JSON.stringify({ book: current, fact: qty, delta }) },
          });
          if (delta !== 0) {
            await applyStockDelta(doc.toWarehouseId, productId, delta, tx);
            await tx.stockMovement.create({
              data: {
                type: movementType,
                productId,
                quantity: Math.abs(delta),
                documentId: doc.id,
                warehouseId: doc.toWarehouseId,
                createdById: postedById,
                note: `Инвентаризация #${doc.number} (${delta > 0 ? "+" : "-"}${Math.abs(delta)})`,
              },
            });
          }
          break;
        }
        case "ADJUSTMENT": {
          if (!doc.toWarehouseId) throw new Error("Не указан склад");
          const current = await getStockQuantity(doc.toWarehouseId, productId, tx);
          const delta = qty - current;
          await applyStockDelta(doc.toWarehouseId, productId, delta, tx);
          await tx.stockMovement.create({
            data: {
              type: movementType,
              productId,
              quantity: Math.abs(delta),
              documentId: doc.id,
              warehouseId: doc.toWarehouseId,
              createdById: postedById,
              note: `Корректировка #${doc.number}`,
            },
          });
          break;
        }
        default:
          throw new Error(`Проведение типа ${doc.type} пока не реализовано`);
      }
    }

    const linesTotal = sumDocumentLines(doc.lines);
    const updated = await tx.stockDocument.update({
      where: { id: documentId },
      data: {
        status: "POSTED",
        postedAt: new Date(),
        postedById,
        linesTotal,
        totalPurchaseCost: linesTotal,
        discrepancyReason: meta?.discrepancyReason ?? doc.discrepancyReason,
      },
      include: { lines: true, supplier: true },
    });

    await tx.documentChangeLog.create({
      data: {
        documentId,
        userId: postedById,
        action: "POSTED",
        newValue: JSON.stringify({ number: updated.number, linesTotal }),
      },
    });

    await logActivity({
      userId: postedById,
      userRole: postedByRole,
      action: "DOCUMENT_POSTED",
      entityType: "StockDocument",
      entityId: documentId,
      newValue: JSON.stringify({ number: updated.number, type: updated.type }),
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      tx,
    });

    return updated;
}

export async function cancelDocument(
  documentId: string,
  userId: string,
  userRole: Role,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  return prisma.$transaction(async (tx) => {
    const doc = await tx.stockDocument.findUnique({
      where: { id: documentId },
      include: { lines: { where: { excluded: false } } },
    });
    if (!doc) throw new Error("Документ не найден");
    if (doc.status !== "POSTED") throw new Error("Отменить можно только проведённый документ");

    for (const line of doc.lines) {
      if (!line.productId) continue;
      const productId = line.productId;
      const qty = line.quantity;

      switch (doc.type) {
        case "RECEIPT":
          if (doc.toWarehouseId) await applyStockDelta(doc.toWarehouseId, productId, -qty, tx);
          break;
        case "TRANSFER":
          if (doc.fromWarehouseId && doc.toWarehouseId) {
            await applyStockDelta(doc.toWarehouseId, productId, -qty, tx);
            await applyStockDelta(doc.fromWarehouseId, productId, qty, tx);
          }
          break;
        case "RETURN":
          if (doc.fromWarehouseId && doc.toWarehouseId) {
            await applyStockDelta(doc.toWarehouseId, productId, -qty, tx);
            await applyStockDelta(doc.fromWarehouseId, productId, qty, tx);
          }
          break;
        case "WRITE_OFF":
          if (doc.fromWarehouseId) await applyStockDelta(doc.fromWarehouseId, productId, qty, tx);
          break;
        case "INVENTORY":
          if (doc.toWarehouseId) {
            let delta = 0;
            try {
              const lineMeta = JSON.parse(line.receiptLineText ?? "{}");
              delta = typeof lineMeta.delta === "number" ? lineMeta.delta : 0;
            } catch {
              /* skip */
            }
            if (delta !== 0) await applyStockDelta(doc.toWarehouseId, productId, -delta, tx);
          }
          break;
        case "SALE":
          if (doc.fromWarehouseId) await applyStockDelta(doc.fromWarehouseId, productId, qty, tx);
          break;
        default:
          break;
      }
    }

    await tx.stockMovement.updateMany({
      where: { documentId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    const updated = await tx.stockDocument.update({
      where: { id: documentId },
      data: { status: "CANCELLED" },
    });

    await tx.documentChangeLog.create({
      data: { documentId, userId, action: "CANCELLED" },
    });

    await logActivity({
      userId,
      userRole,
      action: "DOCUMENT_CANCELLED",
      entityType: "StockDocument",
      entityId: documentId,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
      tx,
    });

    return updated;
  });
}

export async function ensureCentralWarehouseForReceipt() {
  return getCentralWarehouse();
}
