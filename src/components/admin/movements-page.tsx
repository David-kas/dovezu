"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, MOVEMENT_TYPE_LABELS } from "@/lib/utils";

interface Movement {
  id: string;
  type: string;
  quantity: number;
  createdAt: string;
  note?: string | null;
  product: { name: string };
  fromCourier?: { name: string } | null;
  toCourier?: { name: string } | null;
  order?: { orderNumber: number } | null;
}

export function MovementsPage() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [typeFilter, setTypeFilter] = useState("");

  useEffect(() => {
    const params = typeFilter ? `?type=${typeFilter}` : "";
    fetch(`/api/movements${params}`).then((r) => r.json()).then(setMovements);
  }, [typeFilter]);

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

      <Select value={typeFilter || "all"} onValueChange={(v) => setTypeFilter(v === "all" ? "" : v)}>
        <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Тип" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все типы</SelectItem>
          {Object.entries(MOVEMENT_TYPE_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

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
                  {m.fromCourier?.name || "Центральный склад"} → {m.toCourier?.name || "—"}
                </div>
                {m.order && <div className="text-sm">Заказ #{m.order.orderNumber}</div>}
                {m.note && <div className="text-sm text-muted-foreground">{m.note}</div>}
              </div>
              <div className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(m.createdAt)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
