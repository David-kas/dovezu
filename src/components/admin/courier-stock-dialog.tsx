"use client";

import { useEffect, useState } from "react";
import {
  Package,
  RotateCcw,
  Undo2,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";

interface StockItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  salePrice: number;
}

interface CourierStockDialogProps {
  courier: { id: string; name: string } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CourierStockDialog({ courier, open, onOpenChange }: CourierStockDialogProps) {
  const [stock, setStock] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [returnQty, setReturnQty] = useState<Record<string, number>>({});
  const [confirmAction, setConfirmAction] = useState<"selected" | "all" | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadStock() {
    if (!courier) return;
    setLoading(true);
    const res = await fetch(`/api/returns?courierId=${courier.id}`);
    const data = await res.json();
    setStock(data);
    setSelected(new Set());
    const qty: Record<string, number> = {};
    for (const item of data) qty[item.productId] = item.quantity;
    setReturnQty(qty);
    setLoading(false);
  }

  useEffect(() => {
    if (open && courier) loadStock();
  }, [open, courier]);

  function toggleSelect(productId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) next.delete(productId);
      else next.add(productId);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === stock.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(stock.map((s) => s.productId)));
    }
  }

  async function executeReturn(returnAll: boolean) {
    if (!courier) return;
    setSubmitting(true);

    const items = returnAll
      ? undefined
      : stock
          .filter((s) => selected.has(s.productId))
          .map((s) => ({
            productId: s.productId,
            quantity: returnQty[s.productId] || s.quantity,
          }));

    const res = await fetch("/api/returns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courierId: courier.id,
        returnAll,
        items,
      }),
    });

    setSubmitting(false);
    setConfirmAction(null);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    const data = await res.json();
    toast({ title: data.message || "Товары возвращены" });
    loadStock();
  }

  const hasStock = stock.length > 0;
  const selectedCount = selected.size;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Склад — {courier?.name}
            </DialogTitle>
            <DialogDescription>
              Управление остатками курьера
            </DialogDescription>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !hasStock ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <Package className="mx-auto h-10 w-10 text-muted-foreground/50" />
              <p className="mt-3 text-sm text-muted-foreground">
                У данного курьера отсутствуют товары
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  className="text-sm text-primary hover:underline"
                  onClick={toggleAll}
                >
                  {selected.size === stock.length ? "Снять выделение" : "Выбрать все"}
                </button>
                <Badge variant="secondary">{stock.length} позиций</Badge>
              </div>

              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {stock.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                      selected.has(item.productId) ? "border-primary bg-primary/5" : ""
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(item.productId)}
                      onChange={() => toggleSelect(item.productId)}
                      className="h-4 w-4 rounded border-input"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        На руках: {item.quantity} шт.
                      </div>
                    </div>
                    {selected.has(item.productId) && (
                      <Input
                        type="number"
                        min={1}
                        max={item.quantity}
                        className="w-20 h-8"
                        value={returnQty[item.productId] ?? item.quantity}
                        onChange={(e) =>
                          setReturnQty({
                            ...returnQty,
                            [item.productId]: Math.min(+e.target.value, item.quantity),
                          })
                        }
                      />
                    )}
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={selectedCount === 0}
                  onClick={() => setConfirmAction("selected")}
                >
                  <Undo2 className="h-4 w-4 mr-2" />
                  Вернуть товар{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setConfirmAction("all")}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Вернуть всё
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={confirmAction !== null} onOpenChange={() => setConfirmAction(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === "all" ? "Вернуть весь товар?" : "Вернуть выбранные товары?"}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === "all"
                ? `Вернуть весь товар курьера «${courier?.name}» на Центральный склад?`
                : `Вернуть ${selectedCount} выбранных позиций на Центральный склад?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setConfirmAction(null)} disabled={submitting}>
              Отмена
            </Button>
            <Button
              onClick={() => executeReturn(confirmAction === "all")}
              disabled={submitting}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Подтвердить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
