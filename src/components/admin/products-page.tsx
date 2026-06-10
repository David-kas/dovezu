"use client";

import { useEffect, useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Search, Download } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { formatCurrency, PRODUCT_STATUS_LABELS } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  centralStock: number;
  imageUrl?: string | null;
  status: string;
}

const emptyProduct = {
  name: "",
  category: "",
  purchasePrice: 0,
  salePrice: 0,
  centralStock: 0,
  imageUrl: "",
  status: "ACTIVE",
};

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyProduct);
  const [loading, setLoading] = useState(true);

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category))].sort(),
    [products]
  );

  async function loadProducts() {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (categoryFilter) params.set("category", categoryFilter);
    if (statusFilter) params.set("status", statusFilter);

    const res = await fetch(`/api/products?${params}`);
    const data = await res.json();
    setProducts(data);
    setLoading(false);
  }

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyProduct);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      category: product.category,
      purchasePrice: product.purchasePrice,
      salePrice: product.salePrice,
      centralStock: product.centralStock,
      imageUrl: product.imageUrl || "",
      status: product.status,
    });
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/products/${editing.id}` : "/api/products";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }

    toast({ title: editing ? "Товар обновлён" : "Товар добавлен" });
    setDialogOpen(false);
    loadProducts();
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить товар?")) return;
    await fetch(`/api/products/${id}`, { method: "DELETE" });
    toast({ title: "Товар удалён" });
    loadProducts();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Товары</h1>
          <p className="text-muted-foreground">Управление каталогом</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/export?type=products">
              <Download className="h-4 w-4 mr-2" />
              Excel
            </a>
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Добавить
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? "Редактировать товар" : "Новый товар"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Наименование</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Категория</Label>
                  <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Закупочная цена</Label>
                    <Input type="number" min="0" step="0.01" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: +e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Цена продажи</Label>
                    <Input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: +e.target.value })} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Остаток на складе</Label>
                  <Input type="number" min="0" value={form.centralStock} onChange={(e) => setForm({ ...form, centralStock: +e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>URL фото (необязательно)</Label>
                  <Input value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} placeholder="https://..." />
                </div>
                <div className="space-y-2">
                  <Label>Статус</Label>
                  <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Активен</SelectItem>
                      <SelectItem value="INACTIVE">Неактивен</SelectItem>
                      <SelectItem value="ARCHIVED">Архив</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">{editing ? "Сохранить" : "Создать"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={categoryFilter || "all"} onValueChange={(v) => setCategoryFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Категория" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все категории</SelectItem>
            {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Статус" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все статусы</SelectItem>
            <SelectItem value="ACTIVE">Активен</SelectItem>
            <SelectItem value="INACTIVE">Неактивен</SelectItem>
            <SelectItem value="ARCHIVED">Архив</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Загрузка...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => (
            <Card key={product.id}>
              <CardContent className="p-4">
                {product.imageUrl && (
                  <img src={product.imageUrl} alt={product.name} className="mb-3 h-32 w-full rounded-lg object-cover" />
                )}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold">{product.name}</h3>
                    <p className="text-sm text-muted-foreground">{product.category}</p>
                  </div>
                  <Badge variant={product.status === "ACTIVE" ? "success" : "secondary"}>
                    {PRODUCT_STATUS_LABELS[product.status]}
                  </Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Закуп:</span> {formatCurrency(product.purchasePrice)}</div>
                  <div><span className="text-muted-foreground">Продажа:</span> {formatCurrency(product.salePrice)}</div>
                  <div className="col-span-2"><span className="text-muted-foreground">Склад:</span> {product.centralStock} шт.</div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openEdit(product)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleDelete(product.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
