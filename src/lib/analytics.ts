import { prisma } from "./prisma";
import { decimalToNumber } from "./utils";
import { startOfDay, startOfMonth, endOfDay } from "date-fns";

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const monthStart = startOfMonth(now);

  const [products, couriers, orders, todayOrders, monthOrders] = await Promise.all([
    prisma.product.findMany({ where: { status: "ACTIVE" } }),
    prisma.user.count({ where: { role: "COURIER", courierStatus: "ACTIVE" } }),
    prisma.order.count(),
    prisma.order.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: todayStart, lte: todayEnd },
      },
      include: { items: true },
    }),
    prisma.order.findMany({
      where: {
        status: "COMPLETED",
        completedAt: { gte: monthStart },
      },
      include: { items: true },
    }),
  ]);

  const totalCentralStock = products.reduce((sum, p) => sum + p.centralStock, 0);

  const calcProfit = (ordersList: typeof todayOrders) =>
    ordersList.reduce((sum, order) => {
      const orderProfit = order.items.reduce((itemSum, item) => {
        const sale = decimalToNumber(item.salePrice);
        const purchase = decimalToNumber(item.purchasePrice);
        return itemSum + (sale - purchase) * item.quantity;
      }, 0);
      return sum + orderProfit;
    }, 0);

  const todayRevenue = todayOrders.reduce(
    (sum, o) => sum + decimalToNumber(o.totalAmount),
    0
  );
  const todayProfit = calcProfit(todayOrders);
  const monthProfit = calcProfit(monthOrders);

  return {
    totalCentralStock,
    couriersCount: couriers,
    ordersCount: orders,
    todaySales: todayRevenue,
    todayProfit,
    monthProfit,
  };
}

export async function getAnalytics() {
  const [products, courierStock, couriers, completedOrders] = await Promise.all([
    prisma.product.findMany({ orderBy: { name: "asc" } }),
    prisma.courierStock.findMany({
      include: {
        courier: { select: { id: true, name: true } },
        product: { select: { id: true, name: true, salePrice: true, purchasePrice: true } },
      },
    }),
    prisma.user.findMany({
      where: { role: "COURIER" },
      select: { id: true, name: true },
    }),
    prisma.order.findMany({
      where: { status: "COMPLETED" },
      include: {
        items: { include: { product: true } },
        courier: { select: { id: true, name: true } },
      },
    }),
  ]);

  const salesByCourier: Record<string, { name: string; revenue: number; profit: number; orders: number }> = {};
  const salesByProduct: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};

  for (const courier of couriers) {
    salesByCourier[courier.id] = { name: courier.name, revenue: 0, profit: 0, orders: 0 };
  }

  for (const order of completedOrders) {
    if (!order.courierId) continue;
    const courierStats = salesByCourier[order.courierId];
    if (!courierStats) continue;

    courierStats.orders += 1;
    courierStats.revenue += decimalToNumber(order.totalAmount);

    for (const item of order.items) {
      const sale = decimalToNumber(item.salePrice);
      const purchase = decimalToNumber(item.purchasePrice);
      const profit = (sale - purchase) * item.quantity;
      courierStats.profit += profit;

      const productId = item.productId;
      if (!salesByProduct[productId]) {
        salesByProduct[productId] = {
          name: item.product.name,
          quantity: 0,
          revenue: 0,
          profit: 0,
        };
      }
      salesByProduct[productId].quantity += item.quantity;
      salesByProduct[productId].revenue += sale * item.quantity;
      salesByProduct[productId].profit += profit;
    }
  }

  const totalRevenue = completedOrders.reduce(
    (sum, o) => sum + decimalToNumber(o.totalAmount),
    0
  );

  const totalProfit = completedOrders.reduce((sum, order) => {
    return (
      sum +
      order.items.reduce((itemSum, item) => {
        const sale = decimalToNumber(item.salePrice);
        const purchase = decimalToNumber(item.purchasePrice);
        return itemSum + (sale - purchase) * item.quantity;
      }, 0)
    );
  }, 0);

  const courierStockGrouped = couriers.map((courier) => ({
    courierId: courier.id,
    courierName: courier.name,
    items: courierStock
      .filter((s) => s.courierId === courier.id && s.quantity > 0)
      .map((s) => ({
        productId: s.productId,
        productName: s.product.name,
        quantity: s.quantity,
        salePrice: decimalToNumber(s.product.salePrice),
      })),
  }));

  return {
    centralStock: products.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      quantity: p.centralStock,
      purchasePrice: decimalToNumber(p.purchasePrice),
      salePrice: decimalToNumber(p.salePrice),
    })),
    courierStock: courierStockGrouped,
    salesByCourier: Object.values(salesByCourier),
    salesByProduct: Object.values(salesByProduct),
    totalRevenue,
    totalProfit,
  };
}
