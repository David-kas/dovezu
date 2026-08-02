import { prisma } from "../prisma";
import type { DocumentType, Prisma, Role } from "@prisma/client";
import {
  getCentralWarehouse,
  getCourierWarehouse,
  syncCentralStockToWarehouse,
  ensureWarehouseStockMigrated,
  alignCentralWarehouseStock,
  resolveCentralWarehouseId,
} from "./inventory.service";
import { postDocumentInTransaction } from "./document-posting.service";
import { decimalToNumber } from "../utils";

export interface DocumentLineInput {
  productId: string;
  quantity: number;
  salePrice?: number;
  purchasePrice?: number;
}

async function createDraftDocument(
  tx: Prisma.TransactionClient,
  input: {
    type: DocumentType;
    authorId: string;
    fromWarehouseId?: string;
    toWarehouseId?: string;
    orderId?: string;
    comment?: string;
    lines: DocumentLineInput[];
  }
) {
  return tx.stockDocument.create({
    data: {
      type: input.type,
      status: "DRAFT",
      authorId: input.authorId,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      orderId: input.orderId,
      comment: input.comment,
      lines: {
        create: input.lines.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          salePrice: line.salePrice,
          purchasePrice: line.purchasePrice,
        })),
      },
    },
    include: { lines: true },
  });
}

export async function createAndPostDocument(input: {
  type: DocumentType;
  authorId: string;
  authorRole: Role;
  fromWarehouseId?: string;
  toWarehouseId?: string;
  orderId?: string;
  comment?: string;
  lines: DocumentLineInput[];
}) {
  return prisma.$transaction(async (tx) => {
    if (input.type === "TRANSFER" && input.fromWarehouseId) {
      const centralId = await resolveCentralWarehouseId(input.fromWarehouseId, tx);
      input.fromWarehouseId = centralId;
      for (const line of input.lines) {
        await alignCentralWarehouseStock(centralId, line.productId, tx);
      }
    }

    const doc = await createDraftDocument(tx, input);
    await postDocumentInTransaction(tx, doc.id, input.authorId, input.authorRole);
    return tx.stockDocument.findUnique({
      where: { id: doc.id },
      include: {
        lines: { include: { product: true } },
        movements: { include: { product: true } },
      },
    });
  });
}

export async function transferToCourierViaDocument(
  courierId: string,
  productId: string,
  quantity: number,
  note: string | undefined,
  authorId: string,
  authorRole: Role
) {
  const courier = await prisma.user.findFirst({
    where: { id: courierId, role: "COURIER", courierStatus: "ACTIVE" },
  });
  if (!courier) throw new Error("Курьер не найден или заблокирован");

  await ensureWarehouseStockMigrated();
  await syncCentralStockToWarehouse(productId);

  const central = await getCentralWarehouse();
  const courierWarehouse = await getCourierWarehouse(courierId);

  const doc = await createAndPostDocument({
    type: "TRANSFER",
    authorId,
    authorRole,
    fromWarehouseId: central.id,
    toWarehouseId: courierWarehouse.id,
    comment: note,
    lines: [{ productId, quantity }],
  });

  const movement = await prisma.stockMovement.findFirst({
    where: { documentId: doc!.id, deletedAt: null },
    include: {
      product: true,
      warehouse: { include: { courier: { select: { id: true, name: true } } } },
    },
  });

  if (!movement) throw new Error("Движение не создано");

  return {
    ...movement,
    toCourier: movement.warehouse?.courier ?? { id: courierId, name: courier.name },
  };
}

export async function returnFromCourierViaDocument(
  courierId: string,
  items: { productId: string; quantity: number }[],
  authorId: string,
  authorRole: Role
) {
  const courier = await prisma.user.findFirst({
    where: { id: courierId, role: "COURIER" },
  });
  if (!courier) throw new Error("Курьер не найден");

  const central = await getCentralWarehouse();
  const courierWarehouse = await getCourierWarehouse(courierId);

  const doc = await createAndPostDocument({
    type: "RETURN",
    authorId,
    authorRole,
    fromWarehouseId: courierWarehouse.id,
    toWarehouseId: central.id,
    comment: `Возврат от курьера ${courier.name}`,
    lines: items.map((item) => ({ productId: item.productId, quantity: item.quantity })),
  });

  return { returned: items.length, documentId: doc!.id, documentNumber: doc!.number };
}

export async function returnAllFromCourierViaDocument(
  courierId: string,
  authorId: string,
  authorRole: Role
) {
  const stockItems = await prisma.courierStock.findMany({
    where: { courierId, quantity: { gt: 0 } },
  });

  if (stockItems.length === 0) {
    throw new Error("У данного курьера отсутствуют товары");
  }

  const result = await returnFromCourierViaDocument(
    courierId,
    stockItems.map((s) => ({ productId: s.productId, quantity: s.quantity })),
    authorId,
    authorRole
  );

  return {
    ...result,
    totalQuantity: stockItems.reduce((s, i) => s + i.quantity, 0),
  };
}

export async function completeOrderViaDocument(
  orderId: string,
  actorId: string,
  actorRole: Role,
  courierId?: string
) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    });

    if (!order) throw new Error("Заказ не найден");
    if (courierId && order.courierId !== courierId) {
      throw new Error("Заказ не принадлежит этому курьеру");
    }
    if (order.status === "COMPLETED") throw new Error("Заказ уже выполнен");
    if (order.status === "CANCELLED") throw new Error("Заказ отменён");

    const effectiveCourierId = order.courierId;
    if (!effectiveCourierId) throw new Error("Курьер не назначен");

    const courierWarehouse = await getCourierWarehouse(effectiveCourierId, tx);

    const doc = await createDraftDocument(tx, {
      type: "SALE",
      authorId: actorId,
      fromWarehouseId: courierWarehouse.id,
      orderId: order.id,
      comment: `Продажа по заказу #${order.orderNumber}`,
      lines: order.items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        salePrice: decimalToNumber(item.salePrice),
        purchasePrice: decimalToNumber(item.purchasePrice),
      })),
    });

    await postDocumentInTransaction(tx, doc.id, actorId, actorRole);

    return tx.order.update({
      where: { id: orderId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
      },
      include: {
        items: { include: { product: true } },
        courier: true,
      },
    });
  });
}
