import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const couriers = await prisma.user.findMany({
    where: { role: "COURIER", courierStatus: "ACTIVE" },
    select: { id: true, name: true, isOnline: true, lastSeenAt: true },
  });

  const locations = await Promise.all(
    couriers.map(async (courier) => {
      const latest = await prisma.courierLocation.findFirst({
        where: { courierId: courier.id },
        orderBy: { createdAt: "desc" },
      });
      return {
        ...courier,
        location: latest,
      };
    })
  );

  return jsonSuccess(locations.filter((c) => c.location));
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["COURIER"]);
  if (error) return error;

  const body = await req.json();
  const { latitude, longitude, accuracy } = body;

  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return jsonError("Invalid coordinates");
  }

  const location = await prisma.courierLocation.create({
    data: {
      courierId: user!.id,
      latitude,
      longitude,
      accuracy: accuracy ?? null,
    },
  });

  await prisma.user.update({
    where: { id: user!.id },
    data: { isOnline: true, lastSeenAt: new Date() },
  });

  return jsonSuccess(location, 201);
}
