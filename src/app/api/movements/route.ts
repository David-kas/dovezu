import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonSuccess } from "@/lib/api-auth";

const MOVEMENT_TYPES = [
  "TRANSFER_TO_COURIER",
  "ORDER_SALE",
  "ORDER_RETURN",
  "RETURN_TO_CENTRAL",
  "ADJUSTMENT",
] as const;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const productId = searchParams.get("productId");
  const courierId = searchParams.get("courierId");
  const includeDeleted = searchParams.get("includeDeleted") === "true";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

  const movements = await prisma.stockMovement.findMany({
    where: {
      ...(type && MOVEMENT_TYPES.includes(type as (typeof MOVEMENT_TYPES)[number])
        ? { type: type as (typeof MOVEMENT_TYPES)[number] }
        : {}),
      ...(productId ? { productId } : {}),
      ...(courierId ? { OR: [{ fromCourierId: courierId }, { toCourierId: courierId }] } : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    },
    include: {
      product: true,
      fromCourier: { select: { id: true, name: true } },
      toCourier: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonSuccess(movements);
}
