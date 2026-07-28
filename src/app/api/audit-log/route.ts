import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { clearHistorySchema } from "@/lib/validations";
import { clearProductMovementHistory } from "@/lib/orders";
import { logAudit, getClientIp } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const logs = await prisma.auditLog.findMany({
    include: {
      admin: { select: { id: true, name: true } },
      courier: { select: { id: true, name: true } },
      product: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonSuccess(logs);
}

export async function DELETE(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = clearHistorySchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  try {
    const result = await clearProductMovementHistory(parsed.data.productId);

    await logAudit({
      action: "CLEAR_MOVEMENT_HISTORY",
      adminId: user!.id,
      productId: parsed.data.productId,
      details: `Очищено записей: ${result.cleared}`,
      ipAddress: getClientIp(req),
    });

    return jsonSuccess({
      message: "История перемещения очищена",
      ...result,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Clear failed");
  }
}
