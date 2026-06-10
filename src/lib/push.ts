import { prisma } from "./prisma";

export async function savePushSubscription(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } }
) {
  return prisma.pushSubscription.upsert({
    where: {
      userId_endpoint: { userId, endpoint: subscription.endpoint },
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
    },
  });
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey || subscriptions.length === 0) {
    return;
  }

  for (const sub of subscriptions) {
    try {
      await fetch(sub.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          TTL: "86400",
        },
        body: JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.url,
        }),
      });
    } catch (error) {
      console.error("Push notification error:", error);
    }
  }
}

export async function sendPushToCouriers(
  courierIds: string[],
  payload: { title: string; body: string; url?: string }
) {
  await Promise.all(courierIds.map((id) => sendPushToUser(id, payload)));
}
