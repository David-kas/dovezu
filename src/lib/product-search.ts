import type { Prisma } from "@prisma/client";

export function buildProductSearchWhere(search: string): Prisma.ProductWhereInput {
  const trimmed = search.trim();
  if (!trimmed) return {};

  const orConditions: Prisma.ProductWhereInput[] = [
    { name: { contains: trimmed, mode: "insensitive" } },
    { article: { contains: trimmed, mode: "insensitive" } },
    { sku: { contains: trimmed, mode: "insensitive" } },
    { barcode: { contains: trimmed, mode: "insensitive" } },
  ];

  if (trimmed.length >= 3) {
    orConditions.push({ id: { contains: trimmed, mode: "insensitive" } });
  }

  return { OR: orConditions };
}
