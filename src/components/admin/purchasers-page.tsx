"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Wallet } from "lucide-react";
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
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface PurchaserRow {
  id: string;
  name: string;
  phone?: string | null;
  login: string;
  totalIssued: number;
  totalPurchased: number;
  balance: number;
  pendingReview: number;
  receiptCount: number;
}

const emptyForm = { name: "", phone: "", login: "", password: "" };

export function PurchasersPage() {
  const [purchasers, setPurchasers] = useState<PurchaserRow[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const res = await fetch("/api/purchasers");
    if (!res.ok) {
      toast({ title: "Ошибка загрузки", variant: "destructive" });
      return;
    }
    setPurchasers(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function createPurchaser(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/purchasers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Закупщик создан" });
    setDialogOpen(false);
    setForm(emptyForm);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Закупщики</h1>
          <p className="text-muted-foreground text-sm">Авансы, отчёты и карточки закупщиков</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Добавить закупщика
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новый закупщик</DialogTitle>
            </DialogHeader>
            <form onSubmit={createPurchaser} className="space-y-4">
              <div>
                <Label htmlFor="name">Имя</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="phone">Телефон</Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+79001234567"
                />
              </div>
              <div>
                <Label htmlFor="login">Логин</Label>
                <Input
                  id="login"
                  value={form.login}
                  onChange={(e) => setForm({ ...form, login: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="password">Пароль</Label>
                <Input
                  id="password"
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full">
                Создать
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {purchasers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Закупщиков пока нет. Создайте первого.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {purchasers.map((p) => (
            <Link key={p.id} href={`/admin/purchasers/${p.id}`}>
              <Card className="transition-colors hover:bg-accent/50">
                <CardContent className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{p.name}</p>
                      {p.pendingReview > 0 && (
                        <Badge variant="secondary">{p.pendingReview} на проверке</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {p.phone ?? p.login} · {p.receiptCount} оприходований
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-muted-foreground">На отчёт</p>
                    <p
                      className={`font-semibold ${
                        p.balance < 0 ? "text-destructive" : p.balance > 0 ? "text-amber-600" : ""
                      }`}
                    >
                      {formatCurrency(p.balance)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Card>
        <CardContent className="flex items-start gap-3 p-4">
          <Wallet className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-medium text-foreground">Как считается баланс</p>
            <p className="mt-1">
              На отчёт = выданные авансы − сумма проведённых оприходований. Положительный баланс —
              закупщик должен сдать деньги или оформить закупки.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
