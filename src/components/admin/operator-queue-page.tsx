"use client";

import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

export function OperatorQueuePage() {
  const [queue, setQueue] = useState<{
    reviewDocs: Array<{ id: string; number: number; createdAt: string; purchaser?: { name: string }; supplier?: { name: string }; linesTotal: number | null }>;
    unmatchedLines: Array<{ id: string; receiptLineText: string | null; document: { number: number } }>;
    counts: { review: number; unmatched: number; discrepancy: number };
  } | null>(null);

  async function load() {
    const res = await fetch("/api/operator/queue");
    setQueue(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  async function postDoc(id: string) {
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
    toast({ title: "Проведено" });
    load();
  }

  if (!queue) return <p className="text-muted-foreground">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Очередь оператора</h1>
        <p className="text-muted-foreground">Документы на проверке</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{queue.counts.review}</p>
              <p className="text-sm text-muted-foreground">На проверке</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <HelpCircle className="h-8 w-8 text-yellow-500" />
            <div>
              <p className="text-2xl font-bold">{queue.counts.unmatched}</p>
              <p className="text-sm text-muted-foreground">Без товара</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-destructive" />
            <div>
              <p className="text-2xl font-bold">{queue.counts.discrepancy}</p>
              <p className="text-sm text-muted-foreground">Расхождения</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Готовы к проведению</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {queue.reviewDocs.map((doc) => (
            <div key={doc.id} className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <p className="font-medium">#{doc.number} — {doc.supplier?.name ?? "—"}</p>
                <p className="text-sm text-muted-foreground">{doc.purchaser?.name} · {formatDate(doc.createdAt)}</p>
                <p className="text-sm">{formatCurrency(doc.linesTotal ?? 0)}</p>
              </div>
              <Button size="sm" onClick={() => postDoc(doc.id)}>Провести</Button>
            </div>
          ))}
          {queue.reviewDocs.length === 0 && (
            <p className="text-muted-foreground text-sm">Очередь пуста</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
