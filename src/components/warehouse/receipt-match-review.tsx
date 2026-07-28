"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, XCircle, Search, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface ReviewLine {
  id: string;
  quantity: number;
  purchasePrice: number | null;
  lineTotal: number | null;
  receiptLineText: string | null;
  matchConfidence: string | null;
  excluded: boolean;
  product?: { id: string; name: string } | null;
}

interface ReviewState {
  document: {
    id: string;
    number: number;
    status: string;
    receiptTotal: number | null;
    attachments: { id: string; fileName: string; fileUrl: string }[];
    supplier?: { name: string } | null;
    lines: ReviewLine[];
  };
  summary: {
    linesTotal: number;
    receiptTotal: number | null;
    discrepancy: { hasDiscrepancy: boolean; diff: number; message?: string };
    counts: { exact: number; probable: number; unmatched: number; excluded: number };
    canSubmit: boolean;
  };
}

interface Product {
  id: string;
  name: string;
  salePrice?: number;
  purchasePrice?: number;
}

function ConfidenceIcon({ confidence, hasProduct }: { confidence: string | null; hasProduct: boolean }) {
  if (!hasProduct) return <XCircle className="h-5 w-5 text-destructive shrink-0" />;
  if (confidence === "EXACT") return <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />;
  if (confidence === "PROBABLE") return <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />;
  return <HelpCircle className="h-5 w-5 text-muted-foreground shrink-0" />;
}

function confidenceBadge(confidence: string | null, hasProduct: boolean) {
  if (!hasProduct) return <Badge variant="destructive">Не найден</Badge>;
  if (confidence === "EXACT") return <Badge className="bg-green-600">Точное</Badge>;
  if (confidence === "PROBABLE") return <Badge className="bg-yellow-500 text-black">Варианты</Badge>;
  return <Badge variant="secondary">—</Badge>;
}

export function ReceiptMatchReview({
  documentId,
  onUpdated,
  readOnly = false,
}: {
  documentId: string;
  onUpdated?: () => void;
  readOnly?: boolean;
}) {
  const [state, setState] = useState<ReviewState | null>(null);
  const [lines, setLines] = useState<ReviewLine[]>([]);
  const [pickLine, setPickLine] = useState<ReviewLine | null>(null);
  const [search, setSearch] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [manualText, setManualText] = useState("");
  const [manualQty, setManualQty] = useState(1);
  const [manualPrice, setManualPrice] = useState("");

  const load = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}/review`);
    const data = await res.json();
    if (res.ok) {
      setState(data);
      setLines(data.document.lines ?? []);
    }
  }, [documentId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!search.trim()) {
      setProducts([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/products?search=${encodeURIComponent(search)}&status=ACTIVE&limit=20`)
        .then((r) => r.json())
        .then((data) => setProducts(Array.isArray(data) ? data : []));
    }, 200);
    return () => clearTimeout(t);
  }, [search]);

  async function matchLine(lineId: string, productId: string) {
    const res = await fetch(`/api/documents/${documentId}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "match", productId }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Товар привязан" });
    setPickLine(null);
    setSearch("");
    load();
    onUpdated?.();
  }

  async function excludeLine(lineId: string) {
    await fetch(`/api/documents/${documentId}/lines/${lineId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "exclude" }),
    });
    load();
    onUpdated?.();
  }

  async function addManualLine() {
    if (!manualText.trim()) return;
    await fetch(`/api/documents/${documentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-line",
        quantity: manualQty,
        purchasePrice: manualPrice ? +manualPrice : undefined,
        receiptLineText: manualText,
      }),
    });
    setManualText("");
    setManualQty(1);
    setManualPrice("");
    load();
    onUpdated?.();
  }

  if (!state) return <p className="text-sm text-muted-foreground">Загрузка проверки...</p>;

  const activeLines = lines.filter((l) => !l.excluded);

  return (
    <div className="space-y-4">
      {state.summary.discrepancy.hasDiscrepancy && (
        <Card className="border-yellow-500 bg-yellow-500/10">
          <CardContent className="p-3 text-sm flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Расхождение суммы: {formatCurrency(state.summary.discrepancy.diff)}</p>
              <p className="text-muted-foreground">
                Чек: {formatCurrency(state.summary.receiptTotal ?? 0)} · Позиции: {formatCurrency(state.summary.linesTotal)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        <Badge variant="outline" className="gap-1"><CheckCircle2 className="h-3 w-3 text-green-600" /> {state.summary.counts.exact}</Badge>
        <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3 text-yellow-500" /> {state.summary.counts.probable}</Badge>
        <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3 text-destructive" /> {state.summary.counts.unmatched}</Badge>
        {state.summary.counts.excluded > 0 && (
          <Badge variant="outline">Исключено: {state.summary.counts.excluded}</Badge>
        )}
      </div>

      {state.document.attachments.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {state.document.attachments.map((a) => (
            <a
              key={a.id}
              href={a.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 block rounded-lg border overflow-hidden w-20 h-20 bg-muted"
            >
              {a.fileUrl.startsWith("data:") || a.fileUrl.match(/\.(jpg|jpeg|png|webp)$/i) ? (
                <img src={a.fileUrl} alt={a.fileName} className="w-full h-full object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs p-1 text-center">{a.fileName}</div>
              )}
            </a>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {activeLines.map((line) => (
          <Card key={line.id} className={!line.product ? "border-destructive/50" : ""}>
            <CardContent className="p-3 flex gap-3 items-start">
              <ConfidenceIcon confidence={line.matchConfidence} hasProduct={!!line.product} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {line.receiptLineText || line.product?.name || "—"}
                </p>
                {line.product && line.receiptLineText && (
                  <p className="text-xs text-muted-foreground truncate">→ {line.product.name}</p>
                )}
                <p className="text-xs mt-1">
                  {line.quantity} шт. × {formatCurrency(line.purchasePrice ?? 0)} = {formatCurrency((line.purchasePrice ?? 0) * line.quantity)}
                </p>
                <div className="mt-2">{confidenceBadge(line.matchConfidence, !!line.product)}</div>
              </div>
              {!readOnly && (
                <div className="flex flex-col gap-1 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => { setPickLine(line); setSearch(""); }}>
                    <Search className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => excludeLine(line.id)}>
                    <Ban className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {!readOnly && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-sm font-medium">Добавить строку вручную</p>
            <Input placeholder="Название из чека" value={manualText} onChange={(e) => setManualText(e.target.value)} />
            <div className="flex gap-2">
              <Input type="number" min={1} className="w-20" value={manualQty} onChange={(e) => setManualQty(+e.target.value)} />
              <Input type="number" min={0} step="0.01" placeholder="Цена" value={manualPrice} onChange={(e) => setManualPrice(e.target.value)} />
              <Button onClick={addManualLine}>+</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!pickLine} onOpenChange={() => setPickLine(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Привязать товар</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">{pickLine?.receiptLineText}</p>
          <Input
            placeholder="Поиск товара..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div className="max-h-60 overflow-y-auto space-y-1">
            {products.map((p) => (
              <button
                key={p.id}
                type="button"
                className="w-full text-left rounded-lg border p-2 text-sm hover:bg-accent"
                onClick={() => pickLine && matchLine(pickLine.id, p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
