import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { pushSubscriptionSchema } from "@/lib/validations";
import { savePushSubscription } from "@/lib/push";

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const body = await req.json();
  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("Invalid subscription");
  }

  await savePushSubscription(user!.id, {
    endpoint: parsed.data.endpoint,
    keys: parsed.data.keys,
  });

  return jsonSuccess({ success: true });
}

export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
  return jsonSuccess({ publicKey });
}
