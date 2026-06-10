import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { productSchema } from "@/lib/validations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { id } = await params;
  const product = await prisma.product.findUnique({ where: { id } });
  if (!product) return jsonError("Товар не найден", 404);

  return jsonSuccess({
    ...product,
    purchasePrice: user!.role === "ADMIN" ? Number(product.purchasePrice) : undefined,
    salePrice: Number(product.salePrice),
    centralStock: user!.role === "ADMIN" ? product.centralStock : undefined,
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const data = parsed.data;
  const product = await prisma.product.update({
    where: { id },
    data: {
      name: data.name,
      category: data.category,
      purchasePrice: data.purchasePrice,
      salePrice: data.salePrice,
      centralStock: data.centralStock,
      imageUrl: data.imageUrl || null,
      status: data.status,
    },
  });

  return jsonSuccess(product);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { id } = await params;
  await prisma.product.delete({ where: { id } });
  return jsonSuccess({ success: true });
}
