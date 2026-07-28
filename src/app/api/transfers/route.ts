import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { transferSchema } from "@/lib/validations";
import { transferToCourier } from "@/lib/orders";

const TRANSFER_TYPES = ["TRANSFER_TO_COURIER", "DOCUMENT_TRANSFER"] as const;

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const courierId = searchParams.get("courierId");

  const movements = await prisma.stockMovement.findMany({
    where: {
      deletedAt: null,
      type: { in: [...TRANSFER_TYPES] },
      ...(courierId
        ? {
            OR: [{ toCourierId: courierId }, { warehouse: { courierId } }],
          }
        : {}),
    },
    include: {
      product: true,
      toCourier: { select: { id: true, name: true } },
      warehouse: { include: { courier: { select: { id: true, name: true } } } },
      document: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const mapped = movements.map((m) => ({
    ...m,
    toCourier: m.toCourier ?? m.warehouse?.courier ?? null,
  }));

  return jsonSuccess(mapped);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
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
      parsed.data.note,
      user!.id
    );
    return jsonSuccess(movement, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Transfer failed");
  }
}
