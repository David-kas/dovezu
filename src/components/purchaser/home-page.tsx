"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingBag, ScanLine, Camera, Send, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface Summary {
  totalIssued: number;
  totalPurchased: number;
  balance: number;
  pendingReview: number;
}

export function PurchaserHomePage() {
  const router = useRouter();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activeDoc, setActiveDoc] = useState<{ id: string; number: number } | null>(null);

  useEffect(() => {
    fetch("/api/purchaser/dashboard").then((r) => r.json()).then(setSummary);
    fetch("/api/documents?status=DRAFT&type=RECEIPT")
      .then((r) => r.json())
      .then((docs) => {
        if (Array.isArray(docs) && docs[0]) setActiveDoc({ id: docs[0].id, number: docs[0].number });
      });
  }, []);

  async function startPurchase() {
    const res = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment: "Новая закупка" }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    const doc = await res.json();
    router.push(`/purchaser/receipt/${doc.id}`);
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-bold">Закупка</h1>
        <p className="text-muted-foreground text-sm">Быстрый сценарий для закупщика</p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Выдано</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.totalIssued)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">На отчёт</p>
              <p className="text-lg font-semibold">{formatCurrency(summary.balance)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Button className="w-full h-14 text-lg" onClick={startPurchase}>
        <ShoppingBag className="h-5 w-5 mr-2" />
        Начать закупку
      </Button>

      {activeDoc && (
        <Card className="cursor-pointer" onClick={() => router.push(`/purchaser/receipt/${activeDoc.id}`)}>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="font-medium">Черновик #{activeDoc.number}</p>
              <p className="text-sm text-muted-foreground">Продолжить закупку</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium text-muted-foreground">Шаги</p>
        {[
          { icon: ShoppingBag, text: "Выбрать магазин" },
          { icon: ScanLine, text: "Сканировать товары" },
          { icon: Camera, text: "Сфотографировать чек" },
          { icon: Send, text: "Отправить оператору" },
        ].map(({ icon: Icon, text }, i) => (
          <div key={i} className="flex items-center gap-3 rounded-lg border p-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-sm font-bold">
              {i + 1}
            </div>
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">{text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
