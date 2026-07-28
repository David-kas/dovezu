"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

interface ReportData {
  summary: {
    totalIssued: number;
    totalPurchased: number;
    balance: number;
    pendingReview: number;
    receiptCount: number;
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

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Наличные",
  CARD: "Карта",
  TRANSFER: "Перевод",
  OTHER: "Другое",
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Черновик",
  REVIEW: "На проверке",
  POSTED: "Проведён",
  CANCELLED: "Отменён",
};

export function PurchaserReportPage() {
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    fetch("/api/purchaser/dashboard")
      .then((r) => r.json())
      .then((summary) => {
        fetch("/api/purchaser/advances")
          .then((r) => r.json())
          .then((advances) => {
            fetch("/api/documents?type=RECEIPT")
              .then((r) => r.json())
              .then((documents) => {
                setData({ summary, advances, documents });
              });
          });
      });
  }, []);

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4 pb-24">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/purchaser">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h1 className="text-xl font-bold">Мой отчёт</h1>
          <p className="text-sm text-muted-foreground">Авансы и закупки</p>
        </div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Выдано</p>
                <p className="text-lg font-semibold">{formatCurrency(data.summary.totalIssued)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">Закуплено</p>
                <p className="text-lg font-semibold">{formatCurrency(data.summary.totalPurchased)}</p>
              </CardContent>
            </Card>
            <Card className="col-span-2">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">На отчёт (остаток)</p>
                <p
                  className={`text-2xl font-bold ${
                    data.summary.balance > 0 ? "text-amber-600" : data.summary.balance < 0 ? "text-destructive" : ""
                  }`}
                >
                  {formatCurrency(data.summary.balance)}
                </p>
                {data.summary.pendingReview > 0 && (
                  <Badge className="mt-2">{data.summary.pendingReview} на проверке</Badge>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Авансы</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.advances.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока не было выдач</p>
              ) : (
                data.advances.map((a) => (
                  <div key={a.id} className="flex justify-between rounded-lg border p-3 text-sm">
                    <div>
                      <p className="font-medium">{formatCurrency(a.amount)}</p>
                      <p className="text-muted-foreground">
                        {PAYMENT_LABELS[a.paymentMethod] ?? a.paymentMethod}
                      </p>
                    </div>
                    <p className="text-muted-foreground">{formatDate(a.issuedAt)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Мои закупки</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Документов нет</p>
              ) : (
                data.documents.map((doc) => (
                  <Link
                    key={doc.id}
                    href={`/purchaser/receipt/${doc.id}`}
                    className="flex justify-between rounded-lg border p-3 text-sm hover:bg-accent/50"
                  >
                    <div>
                      <p className="font-medium">
                        #{doc.number} · {STATUS_LABELS[doc.status] ?? doc.status}
                      </p>
                      <p className="text-muted-foreground">
                        {doc.supplier?.name ?? "—"} · {formatDate(doc.createdAt)}
                      </p>
                    </div>
                    <p className="font-medium">
                      {doc.totalPurchaseCost != null ? formatCurrency(doc.totalPurchaseCost) : "—"}
                    </p>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
