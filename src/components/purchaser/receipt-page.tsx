"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Send, Plus, ArrowLeft, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarcodeScanner } from "@/components/warehouse/barcode-scanner";
import { ReceiptUploader } from "@/components/warehouse/receipt-uploader";
import { ReceiptMatchReview } from "@/components/warehouse/receipt-match-review";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

interface DocLine {
  id: string;
  quantity: number;
  purchasePrice: number | null;
  product?: { id: string; name: string } | null;
  receiptLineText?: string | null;
  excluded?: boolean;
}

interface Document {
  id: string;
  number: number;
  status: string;
  receiptTotal: number | null;
  lines: DocLine[];
  supplier?: { id: string; name: string } | null;
  supplierId?: string | null;
}

interface Supplier {
  id: string;
  name: string;
}

export function PurchaserReceiptPage({ documentId }: { documentId: string }) {
  const router = useRouter();
  const [doc, setDoc] = useState<Document | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [receiptTotal, setReceiptTotal] = useState("");
  const [unknownBarcode, setUnknownBarcode] = useState<string | null>(null);
  const [tab, setTab] = useState("scan");

  const loadDoc = useCallback(async () => {
    const res = await fetch(`/api/documents/${documentId}`);
    const data = await res.json();
    if (!res.ok) return;
    setDoc(data);
    setSupplierId(data.supplierId ?? data.supplier?.id ?? "");
    setReceiptTotal(data.receiptTotal ? String(data.receiptTotal) : "");
  }, [documentId]);

  useEffect(() => {
    loadDoc();
    fetch("/api/suppliers").then((r) => r.json()).then(setSuppliers);
  }, [loadDoc]);

  async function saveMeta() {
    await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update-meta",
        supplierId: supplierId || undefined,
        receiptTotal: receiptTotal ? +receiptTotal : undefined,
      }),
    });
  }

  async function handleScan(barcode: string) {
    const res = await fetch(`/api/barcodes?code=${encodeURIComponent(barcode)}`, {
      headers: { "x-scan-session": documentId },
    });
    const data = await res.json();
    if (data.debounced) return;

    if (!data.found) {
      setUnknownBarcode(barcode);
      return;
    }

    await fetch(`/api/documents/${documentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add-line",
        productId: data.product.id,
        quantity: 1,
        purchasePrice: Number(data.product.purchasePrice),
      }),
    });
    loadDoc();
    toast({ title: "Добавлено", description: data.product.name });
  }

  async function submitReview() {
    await saveMeta();
    const res = await fetch(`/api/documents/${documentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "submit-review" }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      setTab("review");
      return;
    }
    toast({ title: "Отправлено на проверку" });
    router.push("/purchaser");
  }

  const linesTotal = doc?.lines
    .filter((l) => !l.excluded)
    .reduce((s, l) => s + (l.purchasePrice ?? 0) * l.quantity, 0) ?? 0;

  if (!doc) return <p className="p-4 text-muted-foreground">Загрузка...</p>;

  const isEditable = doc.status === "DRAFT";

  return (
    <div className="mx-auto max-w-lg space-y-4 p-4 pb-28">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.push("/purchaser")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">Закупка #{doc.number}</h1>
          <p className="text-xs text-muted-foreground">{doc.status}</p>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Магазин / поставщик</Label>
        <Select
          value={supplierId || "none"}
          onValueChange={(v) => setSupplierId(v === "none" ? "" : v)}
          disabled={!isEditable}
        >
          <SelectTrigger><SelectValue placeholder="Выберите" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Не выбран</SelectItem>
            {suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="scan">Скан</TabsTrigger>
          <TabsTrigger value="receipt">Чек</TabsTrigger>
          <TabsTrigger value="review">Проверка</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-3 mt-3">
          <Button className="w-full h-12" variant="outline" onClick={() => setScannerOpen(true)} disabled={!isEditable}>
            <ScanLine className="h-5 w-5 mr-2" />
            Сканировать штрихкод
          </Button>
          <Card>
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-medium">Позиции ({doc.lines.filter((l) => !l.excluded).length})</p>
              {doc.lines.filter((l) => !l.excluded).map((line) => (
                <div key={line.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{line.product?.name ?? line.receiptLineText ?? "—"} × {line.quantity}</span>
                  <span>{formatCurrency((line.purchasePrice ?? 0) * line.quantity)}</span>
                </div>
              ))}
              <p className="font-semibold text-right pt-2">Итого: {formatCurrency(linesTotal)}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="receipt" className="space-y-3 mt-3">
          {isEditable && <ReceiptUploader documentId={documentId} onUploaded={() => { loadDoc(); setTab("review"); }} />}
          <div className="space-y-2">
            <Label>Сумма по чеку</Label>
            <Input
              type="number"
              value={receiptTotal}
              onChange={(e) => setReceiptTotal(e.target.value)}
              onBlur={saveMeta}
              placeholder="0"
              disabled={!isEditable}
            />
          </div>
        </TabsContent>

        <TabsContent value="review" className="mt-3">
          <ReceiptMatchReview documentId={documentId} onUpdated={loadDoc} readOnly={!isEditable} />
        </TabsContent>
      </Tabs>

      {isEditable && (
        <Button className="w-full h-12" onClick={submitReview}>
          <Send className="h-5 w-5 mr-2" />
          Отправить оператору
        </Button>
      )}

      {!isEditable && (
        <Button className="w-full" variant="outline" onClick={() => setTab("review")}>
          <ClipboardCheck className="h-4 w-4 mr-2" />
          Просмотр проверки
        </Button>
      )}

      <BarcodeScanner open={scannerOpen} onClose={() => setScannerOpen(false)} onScan={handleScan} sessionKey={documentId} />

      {unknownBarcode && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-4">
          <Card className="w-full">
            <CardContent className="p-4 space-y-3">
              <p className="font-medium">Штрихкод не привязан к товару</p>
              <p className="text-sm text-muted-foreground font-mono">{unknownBarcode}</p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setUnknownBarcode(null)}>Пропустить</Button>
                <Button className="flex-1" onClick={() => { setUnknownBarcode(null); setTab("review"); }}>
                  <Plus className="h-4 w-4 mr-1" /> Привязать
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
