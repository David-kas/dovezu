import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonSuccess } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const productId = searchParams.get("productId");
  const courierId = searchParams.get("courierId");
  const limit = parseInt(searchParams.get("limit") || "100", 10);

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(type ? { type: type as "TRANSFER_TO_COURIER" | "ORDER_SALE" | "ORDER_RETURN" | "ADJUSTMENT" } : {}),
      ...(productId ? { productId } : {}),
      ...(courierId ? { OR: [{ fromCourierId: courierId }, { toCourierId: courierId }] } : {}),
    },
    include: {
      product: true,
      fromCourier: { select: { id: true, name: true } },
      toCourier: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonSuccess(movements);
}
