"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/utils";

interface Courier { id: string; name: string; courierStatus: string }
interface Product { id: string; name: string; centralStock: number }
interface Movement {
  id: string;
  quantity: number;
  createdAt: string;
  note?: string | null;
  product: { name: string };
  toCourier?: { name: string } | null;
}

export function TransfersPage() {
  const [couriers, setCouriers] = useState<Courier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [courierId, setCourierId] = useState("");
  const [productId, setProductId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadData() {
    const [couriersRes, productsRes, movementsRes] = await Promise.all([
      fetch("/api/couriers"),
      fetch("/api/products?status=ACTIVE"),
      fetch("/api/transfers"),
    ]);
    const couriersData = await couriersRes.json();
    setCouriers(couriersData.filter((c: Courier) => c.courierStatus === "ACTIVE"));
    setProducts(await productsRes.json());
    setMovements(await movementsRes.json());
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = products.find((p) => p.id === productId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const res = await fetch("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ courierId, productId, quantity, note }),
    });

    setLoading(false);

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: "Товар передан курьеру" });
    setQuantity(1);
    setNote("");
    loadData();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Передача товаров</h1>
        <p className="text-muted-foreground">Перемещение со склада к курьеру</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowRightLeft className="h-5 w-5" />
              Новая передача
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Курьер</Label>
                <Select value={courierId} onValueChange={setCourierId} required>
                  <SelectTrigger><SelectValue placeholder="Выберите курьера" /></SelectTrigger>
                  <SelectContent>
                    {couriers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Товар</Label>
                <Select value={productId} onValueChange={setProductId} required>
                  <SelectTrigger><SelectValue placeholder="Выберите товар" /></SelectTrigger>
                  <SelectContent>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} (склад: {p.centralStock})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Количество</Label>
                <Input
                  type="number"
                  min="1"
                  max={selectedProduct?.centralStock || 9999}
                  value={quantity}
                  onChange={(e) => setQuantity(+e.target.value)}
                  required
                />
                {selectedProduct && (
                  <p className="text-xs text-muted-foreground">
                    Доступно на складе: {selectedProduct.centralStock}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Примечание</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !courierId || !productId}>
                {loading ? "Передача..." : "Подтвердить передачу"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>История передач</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {movements.map((m) => (
                <div key={m.id} className="rounded-lg border p-3 text-sm">
                  <div className="font-medium">{m.product.name}</div>
                  <div className="text-muted-foreground">
                    → {m.toCourier?.name} · {m.quantity} шт.
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{formatDate(m.createdAt)}</div>
                </div>
              ))}
              {movements.length === 0 && (
                <p className="text-muted-foreground text-center py-8">Нет передач</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
