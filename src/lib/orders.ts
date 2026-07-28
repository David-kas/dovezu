import { prisma } from "./prisma";
import { notifyCourierAboutOrder } from "./telegram";
import { sendPushToUser } from "./push";
import { decimalToNumber } from "./utils";
import type { Role } from "@prisma/client";
import {
  transferToCourierViaDocument,
  returnFromCourierViaDocument,
  returnAllFromCourierViaDocument,
  completeOrderViaDocument,
} from "./services/legacy-stock.service";

export async function assignOrderToCourier(orderId: string, courierId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: { include: { product: true } },
      courier: true,
    },
  });

  if (!order) throw new Error("Заказ не найден");
  if (order.status === "COMPLETED" || order.status === "CANCELLED") {
    throw new Error("Нельзя назначить завершённый или отменённый заказ");
  }

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: {
      courierId,
      status: "ASSIGNED",
    },
    include: {
      items: { include: { product: true } },
      courier: true,
    },
  });

  const notificationData = {
    orderNumber: updated.orderNumber,
    address: updated.address,
    clientPhone: updated.clientPhone,
    clientName: updated.clientName,
    comment: updated.comment,
    totalAmount: decimalToNumber(updated.totalAmount),
    items: updated.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      salePrice: decimalToNumber(item.salePrice),
    })),
  };

  await notifyCourierAboutOrder(updated.courier?.telegramChatId, notificationData);

  await sendPushToUser(courierId, {
    title: "Новый заказ",
    body: `Заказ #${updated.orderNumber} — ${updated.address}`,
    url: `/courier/orders`,
  });

  return updated;
}

export async function completeOrder(
  orderId: string,
  actor: { id: string; role: Role; courierId?: string }
) {
  return completeOrderViaDocument(orderId, actor.id, actor.role, actor.courierId);
}

export async function transferToCourier(
  courierId: string,
  productId: string,
  quantity: number,
  note?: string,
  createdById?: string
) {
  if (!createdById) throw new Error("createdById required");
  return transferToCourierViaDocument(
    courierId,
    productId,
    quantity,
    note,
    createdById,
    "ADMIN"
  );
}

export async function returnFromCourier(
  courierId: string,
  items: { productId: string; quantity: number }[],
  createdById: string
) {
  return returnFromCourierViaDocument(courierId, items, createdById, "ADMIN");
}

export async function returnAllFromCourier(courierId: string, createdById: string) {
  return returnAllFromCourierViaDocument(courierId, createdById, "ADMIN");
}

export async function clearProductMovementHistory(productId: string) {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new Error("Товар не найден");

  const result = await prisma.stockMovement.updateMany({
    where: { productId, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  return { cleared: result.count };
}
