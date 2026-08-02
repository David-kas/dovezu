import { prisma } from "../prisma";
import type { Prisma } from "@prisma/client";

export async function getCentralWarehouse(tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  let warehouse = await db.warehouse.findFirst({
    where: { type: "CENTRAL", isActive: true },
  });
  if (!warehouse) {
    warehouse = await db.warehouse.create({
      data: { name: "Центральный склад", type: "CENTRAL" },
    });
  }
  return warehouse;
}

export async function getCourierWarehouse(courierId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  let warehouse = await db.warehouse.findFirst({
    where: { type: "COURIER", courierId },
  });
  if (!warehouse) {
    const courier = await db.user.findUnique({ where: { id: courierId } });
    warehouse = await db.warehouse.create({
      data: {
        name: `Склад — ${courier?.name ?? courierId}`,
        type: "COURIER",
        courierId,
      },
    });
  }
  return warehouse;
}

export async function getWarehouseStock(warehouseId: string, productId: string, tx?: Prisma.TransactionClient) {
  const db = tx ?? prisma;
  return db.warehouseStock.findUnique({
    where: { warehouseId_productId: { warehouseId, productId } },
  });
}

export async function getStockQuantity(warehouseId: string, productId: string, tx?: Prisma.TransactionClient) {
  const stock = await getWarehouseStock(warehouseId, productId, tx);
  return stock?.quantity ?? 0;
}

/** Sync legacy Product.centralStock and CourierStock from WarehouseStock */
export async function syncLegacyStock(
  warehouseId: string,
  productId: string,
  quantity: number,
  tx: Prisma.TransactionClient
) {
  const warehouse = await tx.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return;

  if (warehouse.type === "CENTRAL") {
    await tx.product.update({
      where: { id: productId },
      data: { centralStock: quantity },
    });
  } else if (warehouse.courierId) {
    if (quantity === 0) {
      await tx.courierStock.deleteMany({
        where: { courierId: warehouse.courierId, productId },
      });
    } else {
      await tx.courierStock.upsert({
        where: {
          courierId_productId: { courierId: warehouse.courierId, productId },
        },
        create: { courierId: warehouse.courierId, productId, quantity },
        update: { quantity },
      });
    }
  }
}

export async function applyStockDelta(
  warehouseId: string,
  productId: string,
  delta: number,
  tx: Prisma.TransactionClient
) {
  const existing = await getWarehouseStock(warehouseId, productId, tx);
  const newQty = (existing?.quantity ?? 0) + delta;
  if (newQty < 0) {
    throw new Error("Недостаточно товара на складе");
  }

  if (newQty === 0 && existing) {
    await tx.warehouseStock.delete({ where: { id: existing.id } });
  } else if (existing) {
    await tx.warehouseStock.update({
      where: { id: existing.id },
      data: { quantity: newQty },
    });
  } else if (newQty > 0) {
    await tx.warehouseStock.create({
      data: { warehouseId, productId, quantity: newQty },
    });
  }

  await syncLegacyStock(warehouseId, productId, newQty, tx);
  return newQty;
}

export async function migrateExistingStockToWarehouses() {
  const central = await getCentralWarehouse();

  const products = await prisma.product.findMany({ where: { centralStock: { gt: 0 } } });
  for (const p of products) {
    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: central.id, productId: p.id } },
      create: { warehouseId: central.id, productId: p.id, quantity: p.centralStock },
      update: { quantity: p.centralStock },
    });
  }

  const courierStock = await prisma.courierStock.findMany({ where: { quantity: { gt: 0 } } });
  for (const cs of courierStock) {
    const wh = await getCourierWarehouse(cs.courierId);
    await prisma.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: wh.id, productId: cs.productId } },
      create: { warehouseId: wh.id, productId: cs.productId, quantity: cs.quantity },
      update: { quantity: cs.quantity },
    });
  }
}

/** Если в WarehouseStock 0, а в legacy centralStock есть остаток — переносим (после миграции v3). */
export async function syncCentralStockToWarehouse(
  productId: string,
  tx?: Prisma.TransactionClient
) {
  const db = tx ?? prisma;
  const central = await getCentralWarehouse(tx);
  const product = await db.product.findUnique({ where: { id: productId } });
  if (!product) return;

  const ws = await getWarehouseStock(central.id, productId, tx);
  const warehouseQty = ws?.quantity ?? 0;

  if (warehouseQty === 0 && product.centralStock > 0) {
    await db.warehouseStock.upsert({
      where: { warehouseId_productId: { warehouseId: central.id, productId } },
      create: { warehouseId: central.id, productId, quantity: product.centralStock },
      update: { quantity: product.centralStock },
    });
  }
}

export async function getCentralAvailableQuantity(productId: string, tx?: Prisma.TransactionClient) {
  await syncCentralStockToWarehouse(productId, tx);
  const central = await getCentralWarehouse(tx);
  const qty = await getStockQuantity(central.id, productId, tx);
  if (qty > 0) return qty;

  const product = await (tx ?? prisma).product.findUnique({ where: { id: productId } });
  return product?.centralStock ?? 0;
}

export async function ensureWarehouseStockMigrated() {
  await getCentralWarehouse();
  await migrateExistingStockToWarehouses();
}

export async function listLowStockProducts(warehouseId?: string) {
  const where = warehouseId ? { warehouseId } : {};
  const stocks = await prisma.warehouseStock.findMany({
    where,
    include: { product: true, warehouse: true },
  });
  return stocks.filter((s) => s.product.minStock > 0 && s.quantity <= s.product.minStock);
}
