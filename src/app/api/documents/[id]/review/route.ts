import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { getDocumentReviewState } from "@/lib/services/receipt.service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id } = await params;

  try {
    const state = await getDocumentReviewState(id);
    if (user!.role === "PURCHASER" && state.document.purchaserId !== user!.id) {
      return jsonError("Forbidden", 403);
    }
    return jsonSuccess(state);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed");
  }
}
