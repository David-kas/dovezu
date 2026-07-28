import { prisma } from "../prisma";

export function normalizeReceiptText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function findProductByAlias(receiptText: string, supplierId?: string) {
  const normalized = normalizeReceiptText(receiptText);

  const alias = await prisma.receiptProductAlias.findFirst({
    where: {
      normalizedText: normalized,
      ...(supplierId ? { OR: [{ supplierId }, { supplierId: null }] } : {}),
    },
    orderBy: [{ confirmCount: "desc" }, { lastUsedAt: "desc" }],
    include: { product: true },
  });

  if (alias) {
    await prisma.receiptProductAlias.update({
      where: { id: alias.id },
      data: { confirmCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    return { product: alias.product, confidence: "EXACT" as const };
  }

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", name: { contains: receiptText.slice(0, 20), mode: "insensitive" } },
    take: 5,
  });

  if (products.length === 1) {
    return { product: products[0], confidence: "PROBABLE" as const };
  }
  if (products.length > 1) {
    return { products, confidence: "PROBABLE" as const };
  }

  return { confidence: "UNMATCHED" as const };
}

export async function saveAlias(input: {
  receiptText: string;
  productId: string;
  supplierId?: string;
  confirmedById: string;
}) {
  const normalized = normalizeReceiptText(input.receiptText);
  const existing = await prisma.receiptProductAlias.findFirst({
    where: { normalizedText: normalized, productId: input.productId, supplierId: input.supplierId ?? null },
  });

  if (existing) {
    return prisma.receiptProductAlias.update({
      where: { id: existing.id },
      data: { confirmCount: { increment: 1 }, lastUsedAt: new Date(), confirmedById: input.confirmedById },
    });
  }

  return prisma.receiptProductAlias.create({
    data: {
      receiptText: input.receiptText,
      normalizedText: normalized,
      productId: input.productId,
      supplierId: input.supplierId,
      confirmedById: input.confirmedById,
    },
  });
}
