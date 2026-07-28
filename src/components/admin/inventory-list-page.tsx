"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ClipboardCheck, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface Warehouse {
  id: string;
  name: string;
  type: string;
}

interface InventoryDoc {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  postedAt?: string | null;
  toWarehouse?: { name: string } | null;
  author?: { name: string } | null;
  _count?: { lines: number };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  POSTED: "Проведена",
  CANCELLED: "Отменена",
};

export function InventoryListPage() {
  const [docs, setDocs] = useState<InventoryDoc[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/documents?type=INVENTORY");
    if (res.ok) setDocs(await res.json());
  }

  useEffect(() => {
    load();
    fetch("/api/warehouses")
      .then((r) => r.json())
      .then((list: Warehouse[]) => {
        setWarehouses(list);
        const central = list.find((w) => w.type === "CENTRAL");
        if (central) setWarehouseId(central.id);
      });
  }, []);

  async function createInventory() {
    if (!warehouseId) {
      toast({ title: "Выберите склад", variant: "destructive" });
      return;
    }
    setCreating(true);
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "INVENTORY", warehouseId }),
    });
    setCreating(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    const doc = await res.json();
    window.location.href = `/admin/inventory/${doc.id}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Инвентаризация</h1>
          <p className="text-muted-foreground text-sm">Сверка фактических остатков с учётными</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-48">
            <Select value={warehouseId} onValueChange={setWarehouseId}>
              <SelectTrigger>
                <SelectValue placeholder="Склад" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={createInventory} disabled={creating}>
            <Plus className="h-4 w-4 mr-2" />
            Новая инвентаризация
          </Button>
        </div>
      </div>

      {docs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
            <p className="text-muted-foreground">Инвентаризаций пока нет</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <Link key={doc.id} href={`/admin/inventory/${doc.id}`}>
              <Card className="hover:bg-accent/50 transition-colors">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">#{doc.number}</p>
                      <Badge variant={doc.status === "POSTED" ? "default" : "secondary"}>
                        {STATUS_LABELS[doc.status] ?? doc.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {doc.toWarehouse?.name ?? "—"} · {doc._count?.lines ?? 0} поз. ·{" "}
                      {formatDate(doc.postedAt ?? doc.createdAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
