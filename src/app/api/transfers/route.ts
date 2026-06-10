import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { transferSchema } from "@/lib/validations";
import { transferToCourier } from "@/lib/orders";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const courierId = searchParams.get("courierId");

  const movements = await prisma.stockMovement.findMany({
    where: courierId ? { type: "TRANSFER_TO_COURIER", toCourierId: courierId } : { type: "TRANSFER_TO_COURIER" },
    include: {
      product: true,
      toCourier: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return jsonSuccess(movements);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = transferSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  try {
    const movement = await transferToCourier(
      parsed.data.courierId,
      parsed.data.productId,
      parsed.data.quantity,
      parsed.data.note
    );
    return jsonSuccess(movement, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Transfer failed");
  }
}
