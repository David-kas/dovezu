import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { purchaserSchema } from "@/lib/validations";
import { hashPassword } from "@/lib/password";
import { listPurchasers } from "@/lib/services/purchasing.service";
import { logActivity, getRequestMeta } from "@/lib/services/audit.service";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const purchasers = await listPurchasers();
  return jsonSuccess(purchasers);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = purchaserSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  if (!parsed.data.password) {
    return jsonError("Пароль обязателен при создании закупщика");
  }

  const existing = await prisma.user.findUnique({
    where: { login: parsed.data.login },
  });
  if (existing) return jsonError("Логин уже занят");

  const purchaser = await prisma.user.create({
    data: {
      name: parsed.data.name,
      phone: parsed.data.phone || null,
      login: parsed.data.login,
      passwordHash: await hashPassword(parsed.data.password),
      role: "PURCHASER",
    },
    select: {
      id: true,
      name: true,
      phone: true,
      login: true,
      createdAt: true,
    },
  });

  const meta = getRequestMeta(req);
  await logActivity({
    userId: user!.id,
    userRole: user!.role as "ADMIN",
    action: "PURCHASER_CREATED",
    entityType: "User",
    entityId: purchaser.id,
    newValue: purchaser.name,
    ...meta,
  });

  return jsonSuccess(purchaser, 201);
}
