import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { z } from "zod";

const supplierSchema = z.object({
  name: z.string().min(1),
  legalName: z.string().optional(),
  inn: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  comment: z.string().optional(),
});

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const suppliers = await prisma.supplier.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
  });
  return jsonSuccess(suppliers);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const body = await req.json();
  const parsed = supplierSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Validation error");

  const supplier = await prisma.supplier.create({ data: parsed.data });
  return jsonSuccess(supplier, 201);
}
