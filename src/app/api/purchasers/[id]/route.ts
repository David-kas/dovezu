import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { getPurchaserDetail } from "@/lib/services/purchasing.service";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id } = await params;

  if (user!.role === "PURCHASER" && user!.id !== id) {
    return jsonError("Forbidden", 403);
  }

  try {
    const detail = await getPurchaserDetail(id);
    return jsonSuccess(detail);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Not found", 404);
  }
}
