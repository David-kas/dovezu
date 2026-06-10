import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { productSchema } from "@/lib/validations";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";

  const products = await prisma.product.findMany({
    where: {
      AND: [
        search ? { name: { contains: search, mode: "insensitive" } } : {},
        category ? { category: { equals: category, mode: "insensitive" } } : {},
        status ? { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" } : {},
        user!.role === "COURIER" ? { status: "ACTIVE" } : {},
      ],
    },
    orderBy: { name: "asc" },
  });

  const mapped = products.map((p) => ({
    ...p,
    purchasePrice: user!.role === "ADMIN" ? Number(p.purchasePrice) : undefined,
    salePrice: Number(p.salePrice),
    centralStock: user!.role === "ADMIN" ? p.centralStock : undefined,
  }));

  return jsonSuccess(mapped);
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const data = parsed.data;
  const product = await prisma.product.create({
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

  return jsonSuccess(product, 201);
}
