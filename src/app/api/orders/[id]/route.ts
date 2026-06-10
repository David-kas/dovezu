import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { orderSchema, orderStatusSchema } from "@/lib/validations";
import { assignOrderToCourier, completeOrder } from "@/lib/orders";
import { decimalToNumber } from "@/lib/utils";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: { include: { product: true } },
      courier: { select: { id: true, name: true } },
    },
  });

  if (!order) return jsonError("Заказ не найден", 404);
  if (user!.role === "COURIER" && order.courierId !== user!.id) {
    return jsonError("Forbidden", 403);
  }

  return jsonSuccess({
    ...order,
    totalAmount: decimalToNumber(order.totalAmount),
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const data = parsed.data;
  const products = await prisma.product.findMany({
    where: { id: { in: data.items.map((i) => i.productId) } },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  let totalAmount = 0;
  const orderItems = data.items.map((item) => {
    const product = productMap.get(item.productId)!;
    const salePrice = decimalToNumber(product.salePrice);
    const purchasePrice = decimalToNumber(product.purchasePrice);
    totalAmount += salePrice * item.quantity;
    return {
      productId: item.productId,
      quantity: item.quantity,
      salePrice,
      purchasePrice,
    };
  });

  await prisma.orderItem.deleteMany({ where: { orderId: id } });

  const order = await prisma.order.update({
    where: { id },
    data: {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      address: data.address,
      comment: data.comment || null,
      totalAmount,
      items: { create: orderItems },
    },
    include: { items: { include: { product: true } }, courier: true },
  });

  return jsonSuccess(order);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  if (body.action === "assign" && user!.role === "ADMIN") {
    if (!body.courierId) return jsonError("Укажите курьера");
    try {
      const order = await assignOrderToCourier(id, body.courierId);
      return jsonSuccess(order);
    } catch (e) {
      return jsonError(e instanceof Error ? e.message : "Assign failed");
    }
  }

  if (body.action === "status") {
    const statusParsed = orderStatusSchema.safeParse(body.status);
    if (!statusParsed.success) return jsonError("Неверный статус");

    const existing = await prisma.order.findUnique({ where: { id } });
    if (!existing) return jsonError("Заказ не найден", 404);

    if (user!.role === "COURIER" && existing.courierId !== user!.id) {
      return jsonError("Forbidden", 403);
    }

    if (statusParsed.data === "COMPLETED") {
      try {
        const order = await completeOrder(id, user!.role === "COURIER" ? user!.id : undefined);
        return jsonSuccess(order);
      } catch (e) {
        return jsonError(e instanceof Error ? e.message : "Complete failed");
      }
    }

    const order = await prisma.order.update({
      where: { id },
      data: { status: statusParsed.data },
      include: { items: { include: { product: true } }, courier: true },
    });

    return jsonSuccess(order);
  }

  return jsonError("Unknown action");
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  await prisma.order.delete({ where: { id } });
  return jsonSuccess({ success: true });
}
