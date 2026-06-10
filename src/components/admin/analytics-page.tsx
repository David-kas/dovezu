"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface Analytics {
  totalRevenue: number;
  totalProfit: number;
  centralStock: Array<{ name: string; category: string; quantity: number; salePrice: number }>;
  courierStock: Array<{ courierName: string; items: Array<{ productName: string; quantity: number }> }>;
  salesByCourier: Array<{ name: string; revenue: number; profit: number; orders: number }>;
  salesByProduct: Array<{ name: string; quantity: number; revenue: number; profit: number }>;
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-muted-foreground">Загрузка...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Аналитика</h1>
        <p className="text-muted-foreground">Учёт и отчётность</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Общая выручка</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatCurrency(data.totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Общая прибыль</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold text-emerald-600">{formatCurrency(data.totalProfit)}</p></CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Центральный склад</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Товар</th>
                  <th className="pb-2 pr-4">Категория</th>
                  <th className="pb-2 pr-4">Остаток</th>
                  <th className="pb-2">Цена</th>
                </tr>
              </thead>
              <tbody>
                {data.centralStock.map((item, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">{item.name}</td>
                    <td className="py-2 pr-4">{item.category}</td>
                    <td className="py-2 pr-4">{item.quantity}</td>
                    <td className="py-2">{formatCurrency(item.salePrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Остатки у курьеров</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {data.courierStock.map((c, i) => (
            <div key={i}>
              <h4 className="font-medium mb-2">{c.courierName}</h4>
              {c.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет товаров</p>
              ) : (
                <ul className="text-sm space-y-1">
                  {c.items.map((item, j) => (
                    <li key={j}>{item.productName}: {item.quantity} шт.</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Продажи по курьерам</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.salesByCourier.filter((c) => c.orders > 0).map((c, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-muted-foreground">{c.orders} заказов</div>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(c.revenue)}</div>
                    <div className="text-emerald-600">{formatCurrency(c.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Продажи по товарам</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.salesByProduct.map((p, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <div className="font-medium">{p.name}</div>
                    <div className="text-muted-foreground">{p.quantity} шт.</div>
                  </div>
                  <div className="text-right">
                    <div>{formatCurrency(p.revenue)}</div>
                    <div className="text-emerald-600">{formatCurrency(p.profit)}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
