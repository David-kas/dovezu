import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { buildProductSearchWhere } from "@/lib/product-search";
import { productSchema } from "@/lib/validations";
import { getCentralWarehouse, ensureWarehouseStockMigrated } from "@/lib/services/inventory.service";

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "COURIER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const category = searchParams.get("category") || "";
  const status = searchParams.get("status") || "";
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

  if (user!.role === "ADMIN") {
    await ensureWarehouseStockMigrated();
  }

  const products = await prisma.product.findMany({
    where: {
      AND: [
        search ? buildProductSearchWhere(search) : {},
        category ? { category: { equals: category, mode: "insensitive" } } : {},
        status ? { status: status as "ACTIVE" | "INACTIVE" | "ARCHIVED" } : {},
        user!.role === "COURIER" ? { status: "ACTIVE" } : {},
      ],
    },
    orderBy: { name: "asc" },
    take: limit,
  });

  let centralWarehouseId: string | null = null;
  if (user!.role === "ADMIN") {
    centralWarehouseId = (await getCentralWarehouse()).id;
  }

  const stocks =
    centralWarehouseId && products.length > 0
      ? await prisma.warehouseStock.findMany({
          where: {
            warehouseId: centralWarehouseId,
            productId: { in: products.map((p) => p.id) },
          },
        })
      : [];
  const stockByProduct = new Map(stocks.map((s) => [s.productId, s.quantity]));

  const mapped = products.map((p) => {
      const warehouseStock = stockByProduct.get(p.id) ?? 0;
      const availableStock =
        user!.role === "ADMIN"
          ? warehouseStock > 0
            ? warehouseStock
            : p.centralStock
          : undefined;

      return {
        ...p,
        purchasePrice: user!.role === "ADMIN" ? Number(p.purchasePrice) : undefined,
        salePrice: Number(p.salePrice),
        centralStock: user!.role === "ADMIN" ? p.centralStock : undefined,
        warehouseStock: user!.role === "ADMIN" ? warehouseStock : undefined,
        availableStock,
      };
    });

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
      article: data.article || null,
      sku: data.sku || null,
      barcode: data.barcode || null,
      purchasePrice: data.purchasePrice,
      salePrice: data.salePrice,
      centralStock: data.centralStock,
      imageUrl: data.imageUrl || null,
      status: data.status,
    },
  });

  if (data.centralStock > 0) {
    const central = await getCentralWarehouse();
    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: central.id, productId: product.id } },
      create: { warehouseId: central.id, productId: product.id, quantity: data.centralStock },
      update: { quantity: data.centralStock },
    });
  }

  return jsonSuccess(product, 201);
}
