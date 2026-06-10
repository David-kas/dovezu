import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { decimalToNumber } from "@/lib/utils";

export async function GET() {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const courierId = user!.role === "COURIER" ? user!.id : undefined;

  const stock = await prisma.courierStock.findMany({
    where: courierId ? { courierId, quantity: { gt: 0 } } : { quantity: { gt: 0 } },
    include: {
      product: true,
      courier: user!.role === "ADMIN" ? { select: { id: true, name: true } } : false,
    },
    orderBy: { product: { name: "asc" } },
  });

  const mapped = stock.map((s) => ({
    id: s.id,
    courierId: s.courierId,
    courierName: user!.role === "ADMIN" && "courier" in s && s.courier ? (s.courier as { name: string }).name : undefined,
    productId: s.productId,
    productName: s.product.name,
    quantity: s.quantity,
    salePrice: decimalToNumber(s.product.salePrice),
    purchasePrice: user!.role === "ADMIN" ? decimalToNumber(s.product.purchasePrice) : undefined,
  }));

  return jsonSuccess(mapped);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["COURIER"]);
  if (error) return error;

  const body = await req.json();
  const { latitude, longitude, accuracy } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("Invalid coordinates");
  }

  const location = await prisma.courierLocation.create({
    data: {
      courierId: user!.id,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
    },
  });

  await prisma.user.update({
    where: { id: user!.id },
    data: { isOnline: true, lastSeenAt: new Date() },
  });

  return jsonSuccess(location, 201);
}
