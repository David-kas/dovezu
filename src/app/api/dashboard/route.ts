import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getDashboardStats } from "@/lib/analytics";
import { formatCurrency } from "@/lib/utils";

export async function GET() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const stats = await getDashboardStats();

  return jsonSuccess({
    ...stats,
    todaySalesFormatted: formatCurrency(stats.todaySales),
    todayProfitFormatted: formatCurrency(stats.todayProfit),
    monthProfitFormatted: formatCurrency(stats.monthProfit),
  });
}
