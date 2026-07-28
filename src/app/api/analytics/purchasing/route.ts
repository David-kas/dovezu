import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getPurchasingAnalytics } from "@/lib/purchasing-analytics";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const data = await getPurchasingAnalytics();
  return jsonSuccess(data);
}
