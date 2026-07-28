import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "RETURN_STOCK"
  | "RETURN_ALL_STOCK"
  | "CLEAR_MOVEMENT_HISTORY";

interface LogAuditParams {
  action: AuditAction;
  adminId: string;
  courierId?: string;
  productId?: string;
  quantity?: number;
  details?: string;
  ipAddress?: string;
  tx?: Prisma.TransactionClient;
}

export async function logAudit(params: LogAuditParams) {
  const db = params.tx ?? prisma;
  return db.auditLog.create({
    data: {
      action: params.action,
      adminId: params.adminId,
      courierId: params.courierId ?? null,
      productId: params.productId ?? null,
      quantity: params.quantity ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    },
  });
}

export function getClientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}
