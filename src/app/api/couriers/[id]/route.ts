import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { courierSchema } from "@/lib/validations";
import { hashPassword, generateQrToken } from "@/lib/password";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const courier = await prisma.user.findFirst({
    where: { id, role: "COURIER" },
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
      stockItems: {
        include: { product: true },
      },
    },
  });

  if (!courier) return jsonError("Курьер не найден", 404);
  return jsonSuccess(courier);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = courierSchema.partial().safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name) updateData.name = data.name;
  if (data.phone !== undefined) updateData.phone = data.phone || null;
  if (data.telegram !== undefined) updateData.telegram = data.telegram || null;
  if (data.login) updateData.login = data.login;
  if (data.telegramChatId !== undefined) updateData.telegramChatId = data.telegramChatId || null;
  if (data.password) updateData.passwordHash = await hashPassword(data.password);

  const courier = await prisma.user.update({
    where: { id },
    data: updateData,
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

  return jsonSuccess(courier);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  await prisma.user.delete({ where: { id } });
  return jsonSuccess({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  if (body.action === "block") {
    const courier = await prisma.user.update({
      where: { id },
      data: { courierStatus: "BLOCKED", isOnline: false },
    });
    return jsonSuccess(courier);
  }

  if (body.action === "unblock") {
    const courier = await prisma.user.update({
      where: { id },
      data: { courierStatus: "ACTIVE" },
    });
    return jsonSuccess(courier);
  }

  if (body.action === "regenerate-qr") {
    const qrToken = generateQrToken();
    const courier = await prisma.user.update({
      where: { id },
      data: { qrToken },
      select: { id: true, qrToken: true },
    });
    return jsonSuccess(courier);
  }

  return jsonError("Unknown action");
}
