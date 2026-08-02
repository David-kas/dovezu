"use client";

import { useEffect, useState } from "react";
import { Plus, Download, X, Pencil } from "lucide-react";
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
import { ProductSearchPicker, type SearchProduct } from "@/components/admin/product-search-picker";

interface Courier { id: string; name: string; courierStatus: string }
interface OrderItemEntry {
  productId: string;
  productName: string;
  quantity: number;
  salePrice: number;
}
interface OrderItem {
  id: string;
  quantity: number;
  product: { id: string; name: string };
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
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState({
    clientName: "",
    clientPhone: "",
    address: "",
    comment: "",
    courierId: "",
  });
  const [orderItems, setOrderItems] = useState<OrderItemEntry[]>([]);

  async function loadOrders() {
    const params = statusFilter ? `?status=${statusFilter}` : "";
    const res = await fetch(`/api/orders${params}`);
    setOrders(await res.json());
  }

  useEffect(() => {
    loadOrders();
    fetch("/api/couriers").then((r) => r.json()).then((data) =>
      setCouriers(data.filter((c: Courier) => c.courierStatus === "ACTIVE"))
    );
  }, [statusFilter]);

  function handleProductSelect(product: SearchProduct) {
    setOrderItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          salePrice: product.salePrice,
        },
      ];
    });
  }

  function updateItemQuantity(productId: string, quantity: number) {
    if (quantity < 1) {
      setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
      return;
    }
    setOrderItems((prev) =>
      prev.map((i) => (i.productId === productId ? { ...i, quantity } : i))
    );
  }

  function removeItem(productId: string) {
    setOrderItems((prev) => prev.filter((i) => i.productId !== productId));
  }

  function openCreate() {
    setEditingOrder(null);
    setForm({ clientName: "", clientPhone: "", address: "", comment: "", courierId: "" });
    setOrderItems([]);
    setDialogOpen(true);
  }

  function openEdit(order: Order) {
    setEditingOrder(order);
    setForm({
      clientName: order.clientName,
      clientPhone: order.clientPhone,
      address: order.address,
      comment: order.comment ?? "",
      courierId: order.courier?.id ?? "",
    });
    setOrderItems(
      order.items.map((item) => ({
        productId: item.product.id,
        productName: item.product.name,
        quantity: item.quantity,
        salePrice: item.salePrice,
      }))
    );
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingOrder(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (orderItems.length === 0) {
      toast({ title: "Добавьте товары", variant: "destructive" });
      return;
    }

    const items = orderItems.map(({ productId, quantity }) => ({ productId, quantity }));
    const payload = {
      ...form,
      courierId: form.courierId || undefined,
      items,
    };

    if (editingOrder) {
      const res = await fetch(`/api/orders/${editingOrder.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json();
        toast({ title: "Ошибка", description: err.error, variant: "destructive" });
        return;
      }
      toast({ title: "Заказ сохранён" });
      closeDialog();
      loadOrders();
      return;
    }

    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: "Заказ создан" });
    closeDialog();
    setForm({ clientName: "", clientPhone: "", address: "", comment: "", courierId: "" });
    setOrderItems([]);
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
          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              if (!open) closeDialog();
              else setDialogOpen(true);
            }}
          >
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Новый заказ</Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingOrder ? `Редактировать заказ #${editingOrder.orderNumber}` : "Новый заказ"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
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
                  <ProductSearchPicker
                    onSelect={handleProductSelect}
                    autoFocus={dialogOpen}
                  />
                  {orderItems.length > 0 && (
                    <div className="space-y-2 rounded-lg border p-3">
                      <p className="text-xs font-medium text-muted-foreground">Добавлено в заказ</p>
                      {orderItems.map((item) => (
                        <div key={item.productId} className="flex items-center gap-2">
                          <span className="flex-1 truncate text-sm">{item.productName}</span>
                          <Input
                            type="number"
                            min="1"
                            className="w-20 h-8"
                            value={item.quantity}
                            onChange={(e) => updateItemQuantity(item.productId, +e.target.value)}
                          />
                          <span className="text-sm text-muted-foreground w-20 text-right">
                            {formatCurrency(item.salePrice * item.quantity)}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0"
                            onClick={() => removeItem(item.productId)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                      <div className="border-t pt-2 text-sm font-semibold text-right">
                        Итого: {formatCurrency(orderItems.reduce((s, i) => s + i.salePrice * i.quantity, 0))}
                      </div>
                    </div>
                  )}
                </div>
                <Button type="submit" className="w-full">
                  {editingOrder ? "Сохранить изменения" : "Создать заказ"}
                </Button>
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
                  {order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
                    <Button variant="outline" size="sm" onClick={() => openEdit(order)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Редактировать
                    </Button>
                  )}
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
