"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Clock, FileInput, Eye } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReceiptDoc {
  id: string;
  number: number;
  status: string;
  createdAt: string;
  linesTotal: number | null;
  receiptTotal: number | null;
  supplier?: { name: string } | null;
  purchaser?: { name: string } | null;
  _count?: { lines: number; attachments: number };
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  REVIEW: "На проверке",
  POSTED: "Проведён",
  CANCELLED: "Отменён",
};

export function ReceiptsPage() {
  const [docs, setDocs] = useState<ReceiptDoc[]>([]);
  const [filter, setFilter] = useState("");

  async function load() {
    const params = filter ? `?status=${filter}` : "";
    const res = await fetch(`/api/documents${params}`);
    setDocs(await res.json());
  }

  useEffect(() => {
    load();
  }, [filter]);

  async function postDocument(id: string) {
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id, action: "post" }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Документ проведён" });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Оприходования</h1>
          <p className="text-muted-foreground">Склад → Оприходования</p>
        </div>
        <Button asChild>
          <a href="/purchaser"><FileInput className="h-4 w-4 mr-2" />Новое оприходование</a>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        {["", "REVIEW", "POSTED", "DRAFT"].map((s) => (
          <Button key={s || "all"} variant={filter === s ? "default" : "outline"} size="sm" onClick={() => setFilter(s)}>
            {s ? STATUS_LABELS[s] : "Все"}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {docs.map((doc) => (
          <Card key={doc.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">#{doc.number}</span>
                  <Badge variant={doc.status === "POSTED" ? "success" : doc.status === "REVIEW" ? "warning" : "secondary"}>
                    {STATUS_LABELS[doc.status]}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {doc.supplier?.name ?? "Без поставщика"} · {doc.purchaser?.name ?? "—"}
                </p>
                <p className="text-sm">
                  Позиций: {doc._count?.lines ?? 0} · {formatCurrency(doc.linesTotal ?? 0)}
                  {doc.receiptTotal != null && ` · Чек: ${formatCurrency(doc.receiptTotal)}`}
                </p>
                <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/receipts/${doc.id}`}>
                    <Eye className="h-4 w-4 mr-2" />
                    Проверка
                  </Link>
                </Button>
                {doc.status === "REVIEW" && (
                  <Button onClick={() => postDocument(doc.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Провести
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {docs.length === 0 && <p className="text-center text-muted-foreground py-8">Нет документов</p>}
      </div>
    </div>
  );
}
