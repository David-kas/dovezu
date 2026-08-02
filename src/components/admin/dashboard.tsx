"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Users, ShoppingCart, TrendingUp, DollarSign, Calendar, FileInput, AlertTriangle } from "lucide-react";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface DashboardData {
  totalCentralStock: number;
  couriersCount: number;
  ordersCount: number;
  todaySales: number;
  todayProfit: number;
  monthProfit: number;
  monthPurchaseTotal?: number;
  pendingReviewCount?: number;
  lowStockCount?: number;
  error?: string;
  purchasingUnavailable?: boolean;
}

export function AdminDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) {
          setLoadError(json.error ?? "Не удалось загрузить дашборд");
          return null;
        }
        if (json.error && json.totalCentralStock === undefined) {
          setLoadError(json.error);
          return null;
        }
        return json as DashboardData;
      })
      .then((d) => {
        if (d) setData(d);
      })
      .catch(() => setLoadError("Ошибка сети или сервера"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="text-muted-foreground">Загрузка...</div>;
  }

  if (loadError || !data) {
    return (
      <div className="space-y-4">
        <p className="text-destructive">{loadError ?? "Ошибка загрузки данных"}</p>
        <p className="text-sm text-muted-foreground max-w-lg">
          Если вы недавно обновляли систему, выполните в Supabase SQL из файлов{" "}
          <code className="text-xs">migrate-all.sql</code> и <code className="text-xs">migrate-v3.sql</code>.
        </p>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Обновить страницу
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Дашборд</h1>
        <p className="text-muted-foreground mt-1">Обзор ключевых показателей</p>
        {data.purchasingUnavailable && (
          <p className="text-sm text-amber-600 mt-2">
            Данные о закупках недоступны — выполните в Supabase SQL из{" "}
            <code className="text-xs">migrate-all.sql</code> и <code className="text-xs">migrate-v3.sql</code>.
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Остаток на складе" value={data.totalCentralStock} icon={Package} description="единиц товара" />
        <StatCard title="Курьеры" value={data.couriersCount} icon={Users} description="активных" />
        <StatCard title="Заказы" value={data.ordersCount} icon={ShoppingCart} description="всего" />
        <StatCard title="Продажи сегодня" value={formatCurrency(data.todaySales)} icon={TrendingUp} />
        <StatCard title="Прибыль сегодня" value={formatCurrency(data.todayProfit)} icon={DollarSign} />
        <StatCard title="Прибыль за месяц" value={formatCurrency(data.monthProfit)} icon={Calendar} />
        <StatCard title="Закупки за месяц" value={formatCurrency(data.monthPurchaseTotal ?? 0)} icon={FileInput} description="проведённые оприходования" />
        <StatCard title="На проверке" value={data.pendingReviewCount ?? 0} icon={FileInput} description="оприходований" />
        <StatCard title="Низкий остаток" value={data.lowStockCount ?? 0} icon={AlertTriangle} description="позиций ниже мин." />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" asChild>
          <Link href="/admin/inventory">Инвентаризация</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/analytics">Аналитика закупок</Link>
        </Button>
      </div>
    </div>
  );
}
