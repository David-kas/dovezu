"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReceiptMatchReview } from "@/components/warehouse/receipt-match-review";
import { toast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export function ReceiptReviewPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [doc, setDoc] = useState<{ number: number; status: string; purchaser?: { name: string }; linesTotal: number | null } | null>(null);

  useEffect(() => {
    fetch(`/api/documents/${documentId}`).then((r) => r.json()).then(setDoc);
  }, [documentId]);

  async function postDocument() {
    const res = await fetch("/api/documents", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, action: "post" }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast({ title: "Ошибка", description: err.error, variant: "destructive" });
      return;
    }
    toast({ title: "Документ проведён" });
    router.push("/admin/receipts");
  }

  if (!doc) return <p className="text-muted-foreground">Загрузка...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push("/admin/receipts")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Оприходование #{doc.number}</h1>
          <p className="text-muted-foreground text-sm">
            {doc.purchaser?.name ?? "—"} · {doc.status}
            {doc.linesTotal != null && ` · ${formatCurrency(doc.linesTotal)}`}
          </p>
        </div>
        {doc.status === "REVIEW" && (
          <Button className="ml-auto" onClick={postDocument}>
            <CheckCircle className="h-4 w-4 mr-2" />
            Провести
          </Button>
        )}
      </div>

      <ReceiptMatchReview documentId={documentId} readOnly={doc.status !== "DRAFT" && doc.status !== "REVIEW"} />
    </div>
  );
}
