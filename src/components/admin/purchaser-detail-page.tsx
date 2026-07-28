"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Banknote, FileInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { formatCurrency, formatDate } from "@/lib/utils";

interface DetailData {
  purchaser: { id: string; name: string; phone?: string | null; login: string };
  summary: {
    totalIssued: number;
    totalPurchased: number;
    balance: number;
    pendingReview: number;
    cancelled: number;
    draftCount: number;
    receiptCount: number;
    lastPurchaseAt: string | null;
  };
  advances: Array<{
    id: string;
    amount: number;
    issuedAt: string;
    paymentMethod: string;
    comment?: string | null;
    issuedBy: { name: string };
  }>;
  documents: Array<{
    id: string;
    number: number;
    status: string;
    createdAt: string;
    totalPurchaseCost: number | null;
    supplier?: { name: string } | null;
  }>;
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  REVIEW: "На проверке",
  POSTED: "Проведён",
  CANCELLED: "Отменён",
};

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  TRANSFER: "Перевод",
  OTHER: "Другое",
};

interface Props {
  purchaserId: string;
  canIssueAdvance?: boolean;
}

export function PurchaserDetailPage({ purchaserId, canIssueAdvance = false }: Props) {
  const router = useRouter();
  const [data, setData] = useState<DetailData | null>(null);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    const res = await fetch(`/api/purchasers/${purchaserId}`);
    if (!res.ok) {
      toast({ title: "Закупщик не найден", variant: "destructive" });
      router.push("/admin/purchasers");
      return;
    }
    setData(await res.json());
  }

  useEffect(() => {
    load();
  }, [purchaserId]);

  async function issueAdvance(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const res = await fetch("/api/purchaser/advances", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        purchaserId,
        amount: parseFloat(amount),
        paymentMethod,
        comment: comment || undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Аванс выдан" });
    setAmount("");
    setComment("");
    load();
  }

  if (!data) {
    return <p className="text-muted-foreground">Загрузка...</p>;
  }

  const { purchaser, summary, advances, documents } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/admin/purchasers">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">{purchaser.name}</h1>
          <p className="text-muted-foreground text-sm">
            {purchaser.phone ?? purchaser.login}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Выдано", value: summary.totalIssued },
          { label: "Закуплено", value: summary.totalPurchased },
          { label: "На отчёт", value: summary.balance, highlight: true },
          { label: "Оприходований", value: summary.receiptCount, currency: false },
        ].map(({ label, value, highlight, currency = true }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p
                className={`text-lg font-semibold ${
                  highlight && value < 0
                    ? "text-destructive"
                    : highlight && value > 0
                      ? "text-amber-600"
                      : ""
                }`}
              >
                {currency ? formatCurrency(value) : value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {(summary.pendingReview > 0 || summary.draftCount > 0) && (
        <div className="flex flex-wrap gap-2">
          {summary.draftCount > 0 && (
            <Badge variant="outline">{summary.draftCount} черновиков</Badge>
          )}
          {summary.pendingReview > 0 && (
            <Badge>{summary.pendingReview} на проверке</Badge>
          )}
          {summary.cancelled > 0 && (
            <Badge variant="destructive">{summary.cancelled} отменено</Badge>
          )}
        </div>
      )}

      {canIssueAdvance && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Banknote className="h-5 w-5" />
              Выдать аванс
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={issueAdvance} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Label htmlFor="amount">Сумма, ₽</Label>
                <Input
                  id="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  required
                />
              </div>
              <div>
                <Label>Способ оплаты</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="comment">Комментарий</Label>
                <Input
                  id="comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Необязательно"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" disabled={submitting}>
                  Выдать аванс
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">История авансов</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {advances.length === 0 ? (
            <p className="text-sm text-muted-foreground">Авансы ещё не выдавались</p>
          ) : (
            advances.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-lg border p-3 text-sm"
              >
                <div>
                  <p className="font-medium">{formatCurrency(a.amount)}</p>
                  <p className="text-muted-foreground">
                    {PAYMENT_LABELS[a.paymentMethod] ?? a.paymentMethod} · {a.issuedBy.name}
                    {a.comment ? ` · ${a.comment}` : ""}
                  </p>
                </div>
                <p className="text-muted-foreground shrink-0">{formatDate(a.issuedAt)}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileInput className="h-5 w-5" />
            Оприходования
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет документов</p>
          ) : (
            documents.map((doc) => (
              <Link
                key={doc.id}
                href={
                  doc.status === "DRAFT"
                    ? `/purchaser/receipt/${doc.id}`
                    : `/admin/receipts/${doc.id}`
                }
                className="flex items-center justify-between rounded-lg border p-3 text-sm hover:bg-accent/50"
              >
                <div>
                  <p className="font-medium">
                    #{doc.number} · {STATUS_LABELS[doc.status] ?? doc.status}
                  </p>
                  <p className="text-muted-foreground">
                    {doc.supplier?.name ?? "Без поставщика"} · {formatDate(doc.createdAt)}
                  </p>
                </div>
                <p className="font-medium shrink-0">
                  {doc.totalPurchaseCost != null
                    ? formatCurrency(doc.totalPurchaseCost)
                    : "—"}
                </p>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
