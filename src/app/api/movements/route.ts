import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonSuccess } from "@/lib/api-auth";

const MOVEMENT_TYPES = [
  "TRANSFER_TO_COURIER",
  "ORDER_SALE",
  "ORDER_RETURN",
  "RETURN_TO_CENTRAL",
  "ADJUSTMENT",
  "DOCUMENT_RECEIPT",
  "DOCUMENT_TRANSFER",
  "DOCUMENT_RETURN",
  "DOCUMENT_WRITE_OFF",
  "DOCUMENT_SALE",
  "DOCUMENT_INVENTORY",
  "DOCUMENT_ADJUSTMENT",
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
      ...(courierId
        ? {
            OR: [
              { fromCourierId: courierId },
              { toCourierId: courierId },
              { warehouse: { courierId } },
            ],
          }
        : {}),
      ...(!includeDeleted ? { deletedAt: null } : {}),
    },
    include: {
      product: true,
      fromCourier: { select: { id: true, name: true } },
      toCourier: { select: { id: true, name: true } },
      order: { select: { id: true, orderNumber: true } },
      document: { select: { id: true, number: true, type: true } },
      warehouse: { include: { courier: { select: { id: true, name: true } } } },
      createdBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  const mapped = movements.map((m) => ({
    ...m,
    toCourier: m.toCourier ?? m.warehouse?.courier ?? null,
    fromCourier: m.fromCourier ?? null,
  }));

  return jsonSuccess(mapped);
}
