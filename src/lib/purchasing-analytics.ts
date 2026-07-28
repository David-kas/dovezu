import { prisma } from "./prisma";
import { decimalToNumber } from "./utils";
import { startOfMonth, subDays, startOfDay } from "date-fns";
import { listLowStockProducts } from "./services/inventory.service";

export async function getPurchasingAnalytics() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const weekStart = subDays(startOfDay(now), 7);

  const [
    postedReceipts,
    reviewReceipts,
    advances,
    purchasers,
    suppliers,
    lowStock,
  ] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { type: "RECEIPT", status: "POSTED", postedAt: { gte: monthStart } },
      include: {
        supplier: { select: { name: true } },
        purchaser: { select: { name: true } },
        lines: { where: { excluded: false }, include: { product: { select: { name: true } } } },
      },
      orderBy: { postedAt: "desc" },
    }),
    prisma.stockDocument.count({ where: { type: "RECEIPT", status: "REVIEW" } }),
    prisma.purchaserAdvance.findMany({
      where: { issuedAt: { gte: monthStart } },
      include: { purchaser: { select: { name: true } } },
    }),
    prisma.user.findMany({
      where: { role: "PURCHASER" },
      select: { id: true, name: true },
    }),
    prisma.stockDocument.groupBy({
      by: ["supplierId"],
      where: { type: "RECEIPT", status: "POSTED", postedAt: { gte: monthStart }, supplierId: { not: null } },
      _sum: { totalPurchaseCost: true },
      _count: { id: true },
    }),
    listLowStockProducts(),
  ]);

  const monthPurchaseTotal = postedReceipts.reduce(
    (s, d) => s + (d.totalPurchaseCost ? decimalToNumber(d.totalPurchaseCost) : 0),
    0
  );
  const monthAdvanceTotal = advances.reduce((s, a) => s + decimalToNumber(a.amount), 0);

  const weekReceipts = postedReceipts.filter(
    (d) => d.postedAt && d.postedAt >= weekStart
  );
  const weekPurchaseTotal = weekReceipts.reduce(
    (s, d) => s + (d.totalPurchaseCost ? decimalToNumber(d.totalPurchaseCost) : 0),
    0
  );

  const supplierIds = suppliers.map((s) => s.supplierId).filter(Boolean) as string[];
  const supplierNames = await prisma.supplier.findMany({
    where: { id: { in: supplierIds } },
    select: { id: true, name: true },
  });
  const supplierNameMap = Object.fromEntries(supplierNames.map((s) => [s.id, s.name]));

  const purchasesBySupplier = suppliers
    .map((s) => ({
      supplierId: s.supplierId,
      supplierName: s.supplierId ? supplierNameMap[s.supplierId] ?? "—" : "—",
      total: s._sum.totalPurchaseCost ? decimalToNumber(s._sum.totalPurchaseCost) : 0,
      count: s._count.id,
    }))
    .sort((a, b) => b.total - a.total);

  const productTotals: Record<string, { name: string; quantity: number; total: number }> = {};
  for (const doc of postedReceipts) {
    for (const line of doc.lines) {
      if (!line.productId || !line.product) continue;
      if (!productTotals[line.productId]) {
        productTotals[line.productId] = { name: line.product.name, quantity: 0, total: 0 };
      }
      productTotals[line.productId].quantity += line.quantity;
      productTotals[line.productId].total += line.lineTotal
        ? decimalToNumber(line.lineTotal)
        : line.purchasePrice
          ? decimalToNumber(line.purchasePrice) * line.quantity
          : 0;
    }
  }

  const purchasesByProduct = Object.values(productTotals).sort((a, b) => b.total - a.total);

  const purchaserBalances = await Promise.all(
    purchasers.map(async (p) => {
      const [adv, rec] = await Promise.all([
        prisma.purchaserAdvance.aggregate({
          where: { purchaserId: p.id },
          _sum: { amount: true },
        }),
        prisma.stockDocument.aggregate({
          where: { purchaserId: p.id, type: "RECEIPT", status: "POSTED" },
          _sum: { totalPurchaseCost: true },
        }),
      ]);
      const issued = adv._sum.amount ? decimalToNumber(adv._sum.amount) : 0;
      const purchased = rec._sum.totalPurchaseCost ? decimalToNumber(rec._sum.totalPurchaseCost) : 0;
      return { id: p.id, name: p.name, issued, purchased, balance: issued - purchased };
    })
  );

  const inventoryDocs = await prisma.stockDocument.count({
    where: { type: "INVENTORY", status: "POSTED", postedAt: { gte: monthStart } },
  });

  return {
    monthPurchaseTotal,
    weekPurchaseTotal,
    monthAdvanceTotal,
    monthReceiptCount: postedReceipts.length,
    pendingReviewCount: reviewReceipts,
    inventoryCount: inventoryDocs,
    purchasesBySupplier,
    purchasesByProduct: purchasesByProduct.slice(0, 20),
    purchaserBalances: purchaserBalances.sort((a, b) => b.balance - a.balance),
    lowStock: lowStock.map((s) => ({
      productId: s.productId,
      productName: s.product.name,
      warehouseName: s.warehouse.name,
      quantity: s.quantity,
      minStock: s.product.minStock,
    })),
    recentReceipts: postedReceipts.slice(0, 10).map((d) => ({
      id: d.id,
      number: d.number,
      postedAt: d.postedAt,
      total: d.totalPurchaseCost ? decimalToNumber(d.totalPurchaseCost) : 0,
      supplier: d.supplier?.name ?? "—",
      purchaser: d.purchaser?.name ?? "—",
    })),
  };
}

