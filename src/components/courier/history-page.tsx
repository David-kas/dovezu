"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Order {
  id: string;
  orderNumber: number;
  clientName: string;
  clientPhone: string;
  address: string;
  comment?: string | null;
  totalAmount: number;
  items: Array<{ id: string; quantity: number; product: { name: string } }>;
  completedAt?: string | null;
  createdAt: string;
}

export function CourierHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch("/api/orders?completed=true").then((r) => r.json()).then(setOrders);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">История заказов</h1>
        <p className="text-muted-foreground">Завершённые заказы</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Заказ #{order.orderNumber}</h3>
                <Badge variant="success">Выполнен</Badge>
              </div>
              <p className="text-sm mt-1">{order.clientName} · {order.clientPhone}</p>
              <p className="text-sm text-muted-foreground">{order.address}</p>
              <div className="mt-2 text-sm">
                {order.items.map((item) => (
                  <div key={item.id}>{item.product.name} × {item.quantity}</div>
                ))}
              </div>
              <p className="font-semibold mt-2">{formatCurrency(order.totalAmount)}</p>
              <p className="text-xs text-muted-foreground">
                {order.completedAt ? formatDate(order.completedAt) : formatDate(order.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Нет завершённых заказов</p>
        )}
      </div>
    </div>
  );
}
