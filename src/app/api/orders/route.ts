import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { orderSchema } from "@/lib/validations";
import { assignOrderToCourier } from "@/lib/orders";
import { decimalToNumber } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const courierId = searchParams.get("courierId");
  const completed = searchParams.get("completed");

  const where: Record<string, unknown> = {};

  if (user!.role === "COURIER") {
    where.courierId = user!.id;
  } else if (courierId) {
    where.courierId = courierId;
  }

  if (status) {
    where.status = status;
  }

  if (completed === "true") {
    where.status = "COMPLETED";
  } else if (completed === "false") {
    where.status = { not: "COMPLETED" };
  }

  const orders = await prisma.order.findMany({
    where,
    include: {
      items: { include: { product: true } },
      courier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const mapped = orders.map((o) => ({
    ...o,
    totalAmount: decimalToNumber(o.totalAmount),
    items: o.items.map((item) => ({
      ...item,
      salePrice: decimalToNumber(item.salePrice),
      purchasePrice: user!.role === "ADMIN" ? decimalToNumber(item.purchasePrice) : undefined,
      product: {
        ...item.product,
        salePrice: decimalToNumber(item.product.salePrice),
        purchasePrice: user!.role === "ADMIN" ? decimalToNumber(item.product.purchasePrice) : undefined,
      },
    })),
  }));

  return jsonSuccess(mapped);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = orderSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const data = parsed.data;
  const productIds = data.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
  });

  if (products.length !== productIds.length) {
    return jsonError("Один или несколько товаров не найдены");
  }

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

  const order = await prisma.order.create({
    data: {
      clientName: data.clientName,
      clientPhone: data.clientPhone,
      address: data.address,
      comment: data.comment || null,
      courierId: data.courierId || null,
      totalAmount,
      status: data.courierId ? "ASSIGNED" : "NEW",
      items: { create: orderItems },
    },
    include: {
      items: { include: { product: true } },
      courier: true,
    },
  });

  if (data.courierId) {
    await assignOrderToCourier(order.id, data.courierId);
  }

  return jsonSuccess({
    ...order,
    totalAmount: decimalToNumber(order.totalAmount),
  }, 201);
}
