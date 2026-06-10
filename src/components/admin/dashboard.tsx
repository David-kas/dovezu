"use client";

import { useEffect, useState } from "react";
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, Calendar } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  totalCentralStock: number;
  couriersCount: number;
  ordersCount: number;
  todaySales: number;
  todayProfit: number;
  monthProfit: number;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>;
  }

  if (!data) {
    return <div className="text-destructive">Ошибка загрузки данных</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Обзор ключевых показателей</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Остаток на складе" value={data.totalCentralStock} icon={Package} description="единиц товара" />
        <StatCard title="Курьеры" value={data.couriersCount} icon={Users} description="активных" />
        <StatCard title="Заказы" value={data.ordersCount} icon={ShoppingCart} description="всего" />
        <StatCard title="Продажи сегодня" value={formatCurrency(data.todaySales)} icon={TrendingUp} />
        <StatCard title="Прибыль сегодня" value={formatCurrency(data.todayProfit)} icon={DollarSign} />
        <StatCard title="Прибыль за месяц" value={formatCurrency(data.monthProfit)} icon={Calendar} />
      </div>
    </div>
  );
}
