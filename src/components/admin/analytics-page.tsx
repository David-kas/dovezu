"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

interface PurchasingAnalytics {
  monthPurchaseTotal: number;
  weekPurchaseTotal: number;
  monthAdvanceTotal: number;
  monthReceiptCount: number;
  pendingReviewCount: number;
  inventoryCount: number;
  purchasesBySupplier: Array<{ supplierName: string; total: number; count: number }>;
  purchasesByProduct: Array<{ name: string; quantity: number; total: number }>;
  purchaserBalances: Array<{ name: string; issued: number; purchased: number; balance: number }>;
  lowStock: Array<{ productName: string; warehouseName: string; quantity: number; minStock: number }>;
  recentReceipts: Array<{
    id: string;
    number: number;
    postedAt: string | null;
    total: number;
    supplier: string;
    purchaser: string;
  }>;
}

interface Analytics {
  totalRevenue: number;
  totalProfit: number;
  centralStock: Array<{ name: string; category: string; quantity: number; salePrice: number }>;
  courierStock: Array<{ courierName: string; items: Array<{ productName: string; quantity: number }> }>;
  salesByCourier: Array<{ name: string; revenue: number; profit: number; orders: number }>;
  salesByProduct: Array<{ name: string; quantity: number; revenue: number; profit: number }>;
  purchasing?: PurchasingAnalytics;
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    fetch("/api/analytics").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <div className="text-muted-foreground">Загрузка...</div>;

  const p = data.purchasing;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Аналитика</h1>
        <p className="text-muted-foreground">Продажи, закупки и остатки</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Выручка</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold">{formatCurrency(data.totalRevenue)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Прибыль</CardTitle></CardHeader>
          <CardContent><p className="text-2xl font-bold text-emerald-600">{formatCurrency(data.totalProfit)}</p></CardContent>
        </Card>
        {p && (
          <>
            <Card>
              <CardHeader><CardTitle className="text-base">Закупки за месяц</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{formatCurrency(p.monthPurchaseTotal)}</p></CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">Авансы за месяц</CardTitle></CardHeader>
              <CardContent><p className="text-2xl font-bold">{formatCurrency(p.monthAdvanceTotal)}</p></CardContent>
            </Card>
          </>
        )}
      </div>

      {p && (
        <>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{p.monthReceiptCount} оприходований</Badge>
            <Badge>{p.pendingReviewCount} на проверке</Badge>
            <Badge variant="outline">{p.inventoryCount} инвентаризаций</Badge>
            <Badge variant="outline">Неделя: {formatCurrency(p.weekPurchaseTotal)}</Badge>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Закупки по поставщикам</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {p.purchasesBySupplier.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет данных</p>
                ) : (
                  p.purchasesBySupplier.map((s, i) => (
                    <div key={i} className="flex justify-between text-sm border-b pb-2">
                      <div>
                        <p className="font-medium">{s.supplierName}</p>
                        <p className="text-muted-foreground">{s.count} док.</p>
                      </div>
                      <p className="font-medium">{formatCurrency(s.total)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Топ закупок по товарам</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {p.purchasesByProduct.slice(0, 10).map((item, i) => (
                  <div key={i} className="flex justify-between text-sm border-b pb-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-muted-foreground">{item.quantity} шт.</p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>Баланс закупщиков</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {p.purchaserBalances.map((b, i) => (
                <div key={i} className="flex justify-between text-sm border-b pb-2">
                  <div>
                    <p className="font-medium">{b.name}</p>
                    <p className="text-muted-foreground">
                      выдано {formatCurrency(b.issued)} · закуплено {formatCurrency(b.purchased)}
                    </p>
                  </div>
                  <p className={`font-medium ${b.balance > 0 ? "text-amber-600" : ""}`}>
                    {formatCurrency(b.balance)}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>

          {p.lowStock.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Низкий остаток</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {p.lowStock.map((item, i) => (
                    <div key={i} className="flex justify-between text-sm">
                      <span>{item.productName} · {item.warehouseName}</span>
                      <span className="text-destructive font-medium">
                        {item.quantity} / мин. {item.minStock}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle>Последние оприходования</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {p.recentReceipts.map((r) => (
                <Link
                  key={r.id}
                  href={`/admin/receipts/${r.id}`}
                  className="flex justify-between text-sm border-b pb-2 hover:text-primary"
                >
                  <div>
                    <p className="font-medium">#{r.number} · {r.supplier}</p>
                    <p className="text-muted-foreground">{r.purchaser} · {r.postedAt ? formatDate(r.postedAt) : "—"}</p>
                  </div>
                  <p className="font-medium">{formatCurrency(r.total)}</p>
                </Link>
              ))}
            </CardContent>
          </Card>
        </>
      )}

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
