import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  try {
    const stats = await getDashboardStats();

    return jsonSuccess({
      ...stats,
      todaySalesFormatted: formatCurrency(stats.todaySales),
      todayProfitFormatted: formatCurrency(stats.todayProfit),
      monthProfitFormatted: formatCurrency(stats.monthProfit),
    });
  } catch (e) {
    console.error("dashboard GET failed:", e);
    return jsonSuccess({
      totalCentralStock: 0,
      couriersCount: 0,
      ordersCount: 0,
      todaySales: 0,
      todayProfit: 0,
      monthProfit: 0,
      monthPurchaseTotal: 0,
      pendingReviewCount: 0,
      lowStockCount: 0,
      todaySalesFormatted: formatCurrency(0),
      todayProfitFormatted: formatCurrency(0),
      monthProfitFormatted: formatCurrency(0),
      _degraded: true,
    });
  }
}
