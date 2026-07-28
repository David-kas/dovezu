"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ScanLine, Download, CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarcodeScanner } from "@/components/warehouse/barcode-scanner";
import { toast } from "@/hooks/use-toast";
import { cn, formatDate } from "@/lib/utils";

interface InventoryLine {
  id: string;
  productId: string | null;
  productName: string;
  book: number;
  fact: number;
  delta: number;
}

interface InventoryState {
  document: {
    id: string;
    number: number;
    status: string;
    comment?: string | null;
    postedAt?: string | null;
    toWarehouse?: { name: string } | null;
  };
  lines: InventoryLine[];
  summary: {
    totalLines: number;
    matched: number;
    surplus: number;
    shortage: number;
    totalDelta: number;
  };
}

interface Props {
  documentId: string;
}

export function InventoryDetailPage({ documentId }: Props) {
  const [state, setState] = useState<InventoryState | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/inventory`);
    if (!res.ok) {
      toast({ title: "Документ не найден", variant: "destructive" });
      return;
    }
    setState(await res.json());
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function action(body: Record<string, unknown>) {
    const res = await fetch(`/api/documents/${documentId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return null;
    }
    const data = await res.json();
    setState(data);
    return data;
  }

  async function fillFromWarehouse() {
    const data = await action({ action: "fill-from-warehouse" });
    if (data) toast({ title: `Добавлено ${data.added} позиций` });
  }

  async function updateFact(line: InventoryLine, fact: number) {
    if (!line.productId) return;
    await action({ action: "set-line", productId: line.productId, quantity: fact });
  }

  async function handleScan(barcode: string) {
    const lookup = await fetch(`/api/barcodes?code=${encodeURIComponent(barcode)}`, {
      headers: { "x-scan-session": `inv-${documentId}` },
    });
    const data = await lookup.json();
    if (data.debounced) return;
    if (!data.found || !data.product) {
      toast({ title: "Товар не найден", description: barcode, variant: "destructive" });
      return;
    }
    await action({ action: "increment-line", productId: data.product.id, delta: 1 });
    toast({ title: data.product.name, description: "+1" });
    setScannerOpen(false);
  }

  async function postInventory() {
    if (!state?.lines.length) {
      toast({ title: "Добавьте позиции", variant: "destructive" });
      return;
    }
    if (!confirm("Провести инвентаризацию? Остатки будут скорректированы.")) return;
    setPosting(true);
    const res = await fetch(`/api/documents/${documentId}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "post" }),
    });
    setPosting(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка проведения", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Инвентаризация проведена" });
    load();
  }

  if (!state) return <p className="text-muted-foreground">Загрузка...</p>;

  const { document, lines, summary } = state;
  const isDraft = document.status === "DRAFT";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/admin/inventory">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Инвентаризация #{document.number}</h1>
            <p className="text-muted-foreground text-sm">
              {document.toWarehouse?.name ?? "—"}
              {document.postedAt && ` · проведена ${formatDate(document.postedAt)}`}
            </p>
          </div>
        </div>
        {isDraft && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={fillFromWarehouse}>
              <Download className="h-4 w-4 mr-2" />
              Заполнить со склада
            </Button>
            <Button variant="outline" onClick={() => setScannerOpen(true)}>
              <ScanLine className="h-4 w-4 mr-2" />
              Сканировать
            </Button>
            <Button onClick={postInventory} disabled={posting}>
              <CheckCircle className="h-4 w-4 mr-2" />
              Провести
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Позиций</p>
            <p className="text-xl font-semibold">{summary.totalLines}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Совпадает</p>
            <p className="text-xl font-semibold text-emerald-600">{summary.matched}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Излишки</p>
            <p className="text-xl font-semibold text-amber-600">{summary.surplus}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Недостачи</p>
            <p className="text-xl font-semibold text-destructive">{summary.shortage}</p>
          </CardContent>
        </Card>
      </div>

      {summary.shortage + summary.surplus > 0 && isDraft && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <span>
            Обнаружено расхождений: {summary.surplus} излишков, {summary.shortage} недостач (
            {summary.totalDelta} ед. всего)
          </span>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Позиции</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Нажмите «Заполнить со склада» или отсканируйте товары
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4">Товар</th>
                  <th className="pb-2 pr-4 text-right">Учёт</th>
                  <th className="pb-2 pr-4 text-right">Факт</th>
                  <th className="pb-2 text-right">Δ</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">{line.productName}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">{line.book}</td>
                    <td className="py-2 pr-4 text-right">
                      {isDraft ? (
                        <Input
                          type="number"
                          min={0}
                          className="ml-auto w-20 h-8 text-right"
                          value={line.fact}
                          onChange={(e) =>
                            updateFact(line, parseInt(e.target.value, 10) || 0)
                          }
                        />
                      ) : (
                        <span className="tabular-nums">{line.fact}</span>
                      )}
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right tabular-nums font-medium",
                        line.delta > 0 && "text-amber-600",
                        line.delta < 0 && "text-destructive",
                        line.delta === 0 && "text-muted-foreground"
                      )}
                    >
                      {line.delta > 0 ? `+${line.delta}` : line.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onScan={handleScan}
        sessionKey={`inv-${documentId}`}
      />
    </div>
  );
}
