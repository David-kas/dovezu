import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getAnalytics, getPurchasingAnalytics } from "@/lib/analytics";

export async function GET(req: Request) {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  if (searchParams.get("section") === "purchasing") {
    return jsonSuccess(await getPurchasingAnalytics());
  }

  const analytics = await getAnalytics();
  const purchasing = await getPurchasingAnalytics();
  return jsonSuccess({ ...analytics, purchasing });
}
