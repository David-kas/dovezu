import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const stats = await getDashboardStats();

  return jsonSuccess({
    totalCentralStock: stats.totalCentralStock,
    couriersCount: stats.couriersCount,
    ordersCount: stats.ordersCount,
    todaySales: stats.todaySales,
    todayProfit: stats.todayProfit,
    monthProfit: stats.monthProfit,
    monthPurchaseTotal: stats.monthPurchaseTotal,
    pendingReviewCount: stats.pendingReviewCount,
    lowStockCount: stats.lowStockCount,
    purchasingUnavailable: stats.purchasingUnavailable,
    todaySalesFormatted: formatCurrency(stats.todaySales ?? 0),
    todayProfitFormatted: formatCurrency(stats.todayProfit ?? 0),
    monthProfitFormatted: formatCurrency(stats.monthProfit ?? 0),
  });
}
