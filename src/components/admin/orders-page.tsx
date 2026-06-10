"use client";

import { useEffect, useState } from "react";
import { Plus, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate, ORDER_STATUS_LABELS } from "@/lib/utils";

interface Product { id: string; name: string; salePrice: number; centralStock: number }
interface Courier { id: string; name: string; courierStatus: string }
interface OrderItem {
  id: string;
  quantity: number;
  product: { name: string };
  salePrice: number;
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
  courier?: { id: string; name: string } | null;
  items: OrderItem[];
  createdAt: string;
}

function statusVariant(status: string) {
  switch (status) {
    case "COMPLETED": return "success" as const;
    case "CANCELLED": return "destructive" as const;
    case "IN_TRANSIT": return "warning" as const;
    default: return "secondary" as const;
  }
}

export function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    address: "",
    comment: "",
    courierId: "",
  });
  const [orderItems, setOrderItems] = useState<{ productId: string; quantity: number }[]>([
    { productId: "", quantity: 1 },
  ]);

  async function loadOrders() {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const res = await fetch(`/api/orders${params}`);
    setOrders(await res.json());
  }

  useEffect(() => {
    loadOrders();
    fetch("/api/products?status=ACTIVE").then((r) => r.json()).then(setProducts);
    fetch("/api/couriers").then((r) => r.json()).then((data) =>
      setCouriers(data.filter((c: Courier) => c.courierStatus === "ACTIVE"))
    );
  }, [statusFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const items = orderItems.filter((i) => i.productId && i.quantity > 0);
    if (items.length === 0) {
      toast({ title: "Добавьте товары", variant: "destructive" });
      return;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        courierId: form.courierId || undefined,
        items,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: "Заказ создан" });
    setDialogOpen(false);
    setForm({ clientName: "", clientPhone: "", address: "", comment: "", courierId: "" });
    setOrderItems([{ productId: "", quantity: 1 }]);
    loadOrders();
  }

  async function assignCourier(orderId: string, courierId: string) {
    const res = await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "assign", courierId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Курьер назначен, уведомление отправлено" });
    loadOrders();
  }

  async function updateStatus(orderId: string, status: string) {
    await fetch(`/api/orders/${orderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", status }),
    });
    toast({ title: "Статус обновлён" });
    loadOrders();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Заказы</h1>
          <p className="text-muted-foreground">Управление заказами</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export?type=orders"><Download className="h-4 w-4 mr-2" />Excel</a>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Новый заказ</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle>Новый заказ</DialogTitle></DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Имя клиента</Label>
                  <Input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Телефон</Label>
                  <Input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Адрес</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Комментарий</Label>
                  <Textarea value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Курьер (необязательно)</Label>
                  <Select value={form.courierId || "none"} onValueChange={(v) => setForm({ ...form, courierId: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Выберите курьера" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Не назначать</SelectItem>
                      {couriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  <Label>Товары</Label>
                  {orderItems.map((item, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Select value={item.productId} onValueChange={(v) => {
                        const updated = [...orderItems];
                        updated[idx].productId = v;
                        setOrderItems(updated);
                      }}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Товар" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Input type="number" min="1" className="w-20" value={item.quantity} onChange={(e) => {
                        const updated = [...orderItems];
                        updated[idx].quantity = +e.target.value;
                        setOrderItems(updated);
                      }} />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={() => setOrderItems([...orderItems, { productId: "", quantity: 1 }])}>
                    + Товар
                  </Button>
                </div>
                <Button type="submit" className="w-full">Создать заказ</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
        <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Статус" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-4">
        {orders.map((order) => (
          <Card key={order.id}>
            <CardContent className="p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Заказ #{order.orderNumber}</h3>
                    <Badge variant={statusVariant(order.status)}>{ORDER_STATUS_LABELS[order.status]}</Badge>
                  </div>
                  <p className="text-sm mt-1">{order.clientName} · {order.clientPhone}</p>
                  <p className="text-sm text-muted-foreground">{order.address}</p>
                  {order.comment && <p className="text-sm text-muted-foreground mt-1">💬 {order.comment}</p>}
                  <div className="mt-2 text-sm">
                    {order.items.map((item) => (
                      <div key={item.id}>{item.product.name} × {item.quantity}</div>
                    ))}
                  </div>
                  <p className="font-semibold mt-2">{formatCurrency(order.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex flex-col gap-2 min-w-[180px]">
                  {order.courier ? (
                    <p className="text-sm">Курьер: {order.courier.name}</p>
                  ) : (
                    <Select onValueChange={(v) => assignCourier(order.id, v)}>
                      <SelectTrigger><SelectValue placeholder="Назначить курьера" /></SelectTrigger>
                      <SelectContent>
                        {couriers.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                  {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                    <Select onValueChange={(v) => updateStatus(order.id, v)}>
                      <SelectTrigger><SelectValue placeholder="Сменить статус" /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
