import { prisma } from "../prisma";
import type { Role } from "@prisma/client";

export interface LogActivityParams {
  userId: string;
  userRole: Role;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  userAgent?: string;
  tx?: Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
}

export async function logActivity(params: LogActivityParams) {
  const db = params.tx ?? prisma;
  return db.activityLog.create({
    data: {
      userId: params.userId,
      userRole: params.userRole,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      oldValue: params.oldValue ?? null,
      newValue: params.newValue ?? null,
      ipAddress: params.ipAddress ?? null,
      userAgent: params.userAgent ?? null,
    },
  });
}

export function getRequestMeta(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded ? forwarded.split(",")[0]?.trim() : req.headers.get("x-real-ip") ?? undefined;
  const userAgent = req.headers.get("user-agent") ?? undefined;
  return { ipAddress: ip, userAgent };
}
