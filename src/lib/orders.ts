import { prisma } from "./prisma";
import { notifyCourierAboutOrder } from "./telegram";
import { sendPushToUser } from "./push";
import { decimalToNumber } from "./utils";

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

export async function completeOrder(orderId: string, courierId?: string) {
  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw new Error("Заказ не найден");
    if (courierId && order.courierId !== courierId) {
      throw new Error("Заказ не принадлежит этому курьеру");
    }
    if (order.status === "COMPLETED") throw new Error("Заказ уже выполнен");
    if (order.status === "CANCELLED") throw new Error("Заказ отменён");

    const effectiveCourierId = order.courierId;
    if (!effectiveCourierId) throw new Error("Курьер не назначен");

    for (const item of order.items) {
      const stock = await tx.courierStock.findUnique({
        where: {
          courierId_productId: {
            courierId: effectiveCourierId,
            productId: item.productId,
          },
        },
      });

      if (!stock || stock.quantity < item.quantity) {
        throw new Error(`Недостаточно товара на складе курьера`);
      }

      await tx.courierStock.update({
        where: { id: stock.id },
        data: { quantity: stock.quantity - item.quantity },
      });

      await tx.stockMovement.create({
        data: {
          type: "ORDER_SALE",
          productId: item.productId,
          quantity: item.quantity,
          fromCourierId: effectiveCourierId,
          orderId: order.id,
          note: `Продажа по заказу #${order.orderNumber}`,
        },
      });
    }

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

export async function transferToCourier(
  courierId: string,
  productId: string,
  quantity: number,
  note?: string
) {
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new Error("Товар не найден");
    if (product.centralStock < quantity) {
      throw new Error("Недостаточно товара на центральном складе");
    }

    const courier = await tx.user.findFirst({
      where: { id: courierId, role: "COURIER", courierStatus: "ACTIVE" },
    });
    if (!courier) throw new Error("Курьер не найден или заблокирован");

    await tx.product.update({
      where: { id: productId },
      data: { centralStock: product.centralStock - quantity },
    });

    await tx.courierStock.upsert({
      where: {
        courierId_productId: { courierId, productId },
      },
      create: { courierId, productId, quantity },
      update: { quantity: { increment: quantity } },
    });

    const movement = await tx.stockMovement.create({
      data: {
        type: "TRANSFER_TO_COURIER",
        productId,
        quantity,
        toCourierId: courierId,
        note,
      },
      include: {
        product: true,
        toCourier: { select: { id: true, name: true } },
      },
    });

    return movement;
  });
}
