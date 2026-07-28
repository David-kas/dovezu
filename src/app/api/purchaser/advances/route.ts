import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess, canManageFinances } from "@/lib/api-auth";
import { advanceSchema } from "@/lib/validations";
import { issueAdvance, listAdvances } from "@/lib/services/purchasing.service";
import { logActivity, getRequestMeta } from "@/lib/services/audit.service";
import { decimalToNumber } from "@/lib/utils";
import type { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["PURCHASER", "ADMIN", "OPERATOR"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const purchaserId =
    user!.role === "PURCHASER" ? user!.id : searchParams.get("purchaserId");

  if (!purchaserId) return jsonError("purchaserId required");

  if (user!.role === "PURCHASER" && purchaserId !== user!.id) {
    return jsonError("Forbidden", 403);
  }

  const advances = await listAdvances(purchaserId);
  return jsonSuccess(advances);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  if (!canManageFinances(user!.role as Role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = advanceSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  try {
    const advance = await issueAdvance({
      ...parsed.data,
      issuedById: user!.id,
    });

    const meta = getRequestMeta(req);
    await logActivity({
      userId: user!.id,
      userRole: user!.role as Role,
      action: "PURCHASER_ADVANCE_ISSUED",
      entityType: "PurchaserAdvance",
      entityId: advance.id,
      newValue: String(parsed.data.amount),
      ...meta,
    });

    return jsonSuccess(
      {
        id: advance.id,
        amount: decimalToNumber(advance.amount),
        issuedAt: advance.issuedAt,
        paymentMethod: advance.paymentMethod,
        comment: advance.comment,
        issuedBy: advance.issuedBy,
      },
      201
    );
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed");
  }
}
