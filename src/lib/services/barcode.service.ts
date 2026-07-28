import { prisma } from "../prisma";

const SCAN_DEBOUNCE_MS = 800;
const recentScans = new Map<string, number>();

export function debounceScan(sessionKey: string, barcode: string): boolean {
  const key = `${sessionKey}:${barcode}`;
  const now = Date.now();
  const last = recentScans.get(key);
  if (last && now - last < SCAN_DEBOUNCE_MS) return false;
  recentScans.set(key, now);
  if (recentScans.size > 500) {
    const cutoff = now - SCAN_DEBOUNCE_MS * 2;
    for (const [k, t] of recentScans) {
      if (t < cutoff) recentScans.delete(k);
    }
  }
  return true;
}

export async function lookupBarcode(barcode: string) {
  const normalized = barcode.trim();
  const record = await prisma.productBarcode.findUnique({
    where: { barcode: normalized },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          salePrice: true,
          purchasePrice: true,
          avgPurchasePrice: true,
          status: true,
        },
      },
    },
  });
  if (record) return record;

  const byLegacy = await prisma.product.findFirst({
    where: { barcode: normalized, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      name: true,
      sku: true,
      salePrice: true,
      purchasePrice: true,
      avgPurchasePrice: true,
      status: true,
    },
  });
  if (byLegacy) {
    return {
      id: "legacy",
      productId: byLegacy.id,
      barcode: normalized,
      isPrimary: true,
      product: byLegacy,
    };
  }
  return null;
}

export async function bindBarcode(productId: string, barcode: string, isPrimary = false) {
  const normalized = barcode.trim();
  const existing = await prisma.productBarcode.findUnique({ where: { barcode: normalized } });
  if (existing && existing.productId !== productId) {
    throw new Error("Штрихкод уже привязан к другому товару");
  }

  if (isPrimary) {
    await prisma.productBarcode.updateMany({
      where: { productId, isPrimary: true },
      data: { isPrimary: false },
    });
    await prisma.product.update({
      where: { id: productId },
      data: { barcode: normalized },
    });
  }

  return prisma.productBarcode.upsert({
    where: { barcode: normalized },
    create: { productId, barcode: normalized, isPrimary },
    update: { productId, isPrimary },
    include: { product: true },
  });
}
