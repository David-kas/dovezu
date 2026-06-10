import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getAnalytics } from "@/lib/analytics";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const analytics = await getAnalytics();
  return jsonSuccess(analytics);
}
