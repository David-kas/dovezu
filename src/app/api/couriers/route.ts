import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { courierSchema } from "@/lib/validations";
import { hashPassword, generateQrToken } from "@/lib/password";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const couriers = await prisma.user.findMany({
    where: { role: "COURIER" },
    select: {
      id: true,
      name: true,
      phone: true,
      telegram: true,
      login: true,
      courierStatus: true,
      isOnline: true,
      lastSeenAt: true,
      telegramChatId: true,
      qrToken: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return jsonSuccess(couriers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = courierSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  if (!parsed.data.password) {
    return jsonError("Пароль обязателен при создании курьера");
  }

  const existing = await prisma.user.findUnique({
    where: { login: parsed.data.login },
  });
  if (existing) return jsonError("Логин уже занят");

  const passwordHash = await hashPassword(parsed.data.password);
  const qrToken = generateQrToken();

  const courier = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      telegram: parsed.data.telegram || null,
      login: parsed.data.login,
      passwordHash,
      role: "COURIER",
      telegramChatId: parsed.data.telegramChatId || null,
      qrToken,
    },
    select: {
      id: true,
      name: true,
      phone: true,
      telegram: true,
      login: true,
      courierStatus: true,
      isOnline: true,
      qrToken: true,
      createdAt: true,
    },
  });

  return jsonSuccess(courier, 201);
}
