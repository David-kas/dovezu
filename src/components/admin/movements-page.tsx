"use client";

import { useEffect, useState } from "react";
import { Download, Trash2, Loader2, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatDate, MOVEMENT_TYPE_LABELS, AUDIT_ACTION_LABELS, movementDestinationLabel } from "@/lib/utils";

interface Movement {
  id: string;
  type: string;
  quantity: number;
  createdAt: string;
  note?: string | null;
  product: { id: string; name: string };
  fromCourier?: { name: string } | null;
  toCourier?: { name: string } | null;
  order?: { orderNumber: number } | null;
  createdBy?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
}

interface AuditEntry {
  id: string;
  action: string;
  quantity?: number | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  admin: { name: string };
  courier?: { name: string } | null;
  product?: { name: string } | null;
}

export function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [typeFilter, setTypeFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function loadMovements() {
    const params = new URLSearchParams({ limit: "200" });
    if (typeFilter) params.set("type", typeFilter);
    if (productFilter) params.set("productId", productFilter);
    const res = await fetch(`/api/movements?${params}`);
    setMovements(await res.json());
  }

  async function loadAuditLogs() {
    const res = await fetch("/api/audit-log?limit=30");
    setAuditLogs(await res.json());
  }

  useEffect(() => {
    fetch("/api/products?status=ACTIVE&limit=200").then((r) => r.json()).then(setProducts);
    loadAuditLogs();
  }, []);

  useEffect(() => {
    loadMovements();
  }, [typeFilter, productFilter]);

  async function handleClearHistory() {
    if (!productFilter) return;
    setClearing(true);
    const res = await fetch("/api/audit-log", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId: productFilter }),
    });
    setClearing(false);
    setClearConfirmOpen(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    const data = await res.json();
    toast({ title: data.message || "История очищена" });
    loadMovements();
    loadAuditLogs();
  }

  const selectedProductName = products.find((p) => p.id === productFilter)?.name;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Движения товаров</h1>
          <p className="text-muted-foreground">Полная история перемещений</p>
        </div>
        <Button variant="outline" asChild>
          <a href="/api/export?type=movements"><Download className="h-4 w-4 mr-2" />Excel</a>
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Тип" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все типы</SelectItem>
            {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={productFilter || "all"} onValueChange={(v) => setProductFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Товар" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все товары</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant="destructive"
          size="sm"
          disabled={!productFilter}
          onClick={() => setClearConfirmOpen(true)}
          className="shrink-0"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Очистить историю
        </Button>
      </div>

      <div className="space-y-3">
        {movements.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <div className="font-medium">{m.product.name}</div>
                <div className="text-sm text-muted-foreground">
                  {MOVEMENT_TYPE_LABELS[m.type]} · {m.quantity} шт.
                </div>
                <div className="text-sm">
                  {m.fromCourier?.name || "Центральный склад"} → {movementDestinationLabel(m.type, m.toCourier)}
                </div>
                {m.order && <div className="text-sm">Заказ #{m.order.orderNumber}</div>}
                {m.createdBy && <div className="text-sm text-muted-foreground">Выполнил: {m.createdBy.name}</div>}
                {m.note && <div className="text-sm text-muted-foreground">{m.note}</div>}
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</div>
            </CardContent>
          </Card>
        ))}
        {movements.length === 0 && (
          <p className="text-center text-muted-foreground py-8">Нет записей</p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScrollText className="h-5 w-5" />
            Журнал действий
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {auditLogs.map((log) => (
            <div key={log.id} className="rounded-lg border p-3 text-sm">
              <div className="font-medium">
                {AUDIT_ACTION_LABELS[log.action] || log.action} — {log.admin.name}
              </div>
              <div className="text-muted-foreground mt-1 space-y-0.5">
                {log.courier && <div>Курьер: {log.courier.name}</div>}
                {log.product && <div>Товар: {log.product.name}</div>}
                {log.quantity != null && <div>Количество: {log.quantity}</div>}
                {log.details && <div>{log.details}</div>}
                {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                <div>{formatDate(log.createdAt)}</div>
              </div>
            </div>
          ))}
          {auditLogs.length === 0 && (
            <p className="text-center text-muted-foreground py-4">Журнал пуст</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Очистить историю перемещения?</DialogTitle>
            <DialogDescription>
              Вы действительно хотите очистить историю перемещения
              {selectedProductName ? ` для «${selectedProductName}»` : ""}?
              <br />
              Данное действие необратимо.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setClearConfirmOpen(false)} disabled={clearing}>
              Отмена
            </Button>
            <Button variant="destructive" onClick={handleClearHistory} disabled={clearing}>
              {clearing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Очистить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
