import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { getPurchaserSummary } from "@/lib/services/purchasing.service";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["PURCHASER", "ADMIN", "OPERATOR"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const purchaserId =
    user!.role === "PURCHASER" ? user!.id : searchParams.get("purchaserId");

  if (!purchaserId) return jsonError("purchaserId required");

  const summary = await getPurchaserSummary(purchaserId);
  return jsonSuccess(summary);
}
