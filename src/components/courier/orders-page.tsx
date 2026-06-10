"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/utils";

interface OrderItem {
  id: string;
  quantity: number;
  product: { name: string };
}
interface Order {
  id: string;
  orderNumber: number;
  clientName: string;
  clientPhone: string;
  address: string;
  comment?: string | null;
  status: string;
  totalAmount: number;
  items: OrderItem[];
  createdAt: string;
}

export function CourierOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);

  async function loadOrders() {
    const res = await fetch("/api/orders?completed=false");
    const data = await res.json();
    setOrders(data.filter((o: Order) => o.status !== "COMPLETED" && o.status !== "CANCELLED"));
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 30000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(orderId: string, status: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: "Статус обновлён" });
    loadOrders();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Мои заказы</h1>
        <p className="text-muted-foreground">Активные заказы</p>
      </div>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">Заказ #{order.orderNumber}</h3>
                <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
              </div>
              <p className="text-sm">{order.clientName} · {order.clientPhone}</p>
              <p className="text-sm text-muted-foreground mt-1">📍 {order.address}</p>
              {order.comment && <p className="text-sm text-muted-foreground mt-1">💬 {order.comment}</p>}
              <div className="mt-2 text-sm">
                {order.items.map((item) => (
                  <div key={item.id}>{item.product.name} × {item.quantity}</div>
                ))}
              </div>
              <p className="font-semibold mt-2">{formatCurrency(order.totalAmount)}</p>
              <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {order.status === "ASSIGNED" && (
                  <Button size="sm" onClick={() => {
                    toast({ title: "Заказ принят", description: "Вы подтвердили получение заказа" });
                  }}>
                    Принять
                  </Button>
                )}
                {(order.status === "ASSIGNED" || order.status === "NEW") && (
                  <Button size="sm" variant="outline" onClick={() => updateStatus(order.id, "IN_TRANSIT")}>
                    В пути
                  </Button>
                )}
                {order.status !== "COMPLETED" && (
                  <Button size="sm" variant="default" onClick={() => updateStatus(order.id, "COMPLETED")}>
                    Выполнено
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {orders.length === 0 && (
          <p className="text-muted-foreground text-center py-12">Нет активных заказов</p>
        )}
      </div>
    </div>
  );
}
