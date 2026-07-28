import { prisma } from "../prisma";
import { decimalToNumber } from "../utils";

export async function getPurchaserSummary(purchaserId: string) {
  const advances = await prisma.purchaserAdvance.findMany({
    where: { purchaserId },
    orderBy: { issuedAt: "desc" },
  });
  const totalIssued = advances.reduce((s, a) => s + decimalToNumber(a.amount), 0);

  const postedReceipts = await prisma.stockDocument.findMany({
    where: {
      purchaserId,
      type: "RECEIPT",
      status: "POSTED",
    },
  });
  const totalPurchased = postedReceipts.reduce(
    (s, d) => s + (d.totalPurchaseCost ? decimalToNumber(d.totalPurchaseCost) : 0),
    0
  );

  const pendingReview = await prisma.stockDocument.count({
    where: { purchaserId, status: "REVIEW" },
  });

  const cancelled = await prisma.stockDocument.count({
    where: { purchaserId, status: "CANCELLED" },
  });

  const lastPurchase = await prisma.stockDocument.findFirst({
    where: { purchaserId, type: "RECEIPT", status: "POSTED" },
    orderBy: { postedAt: "desc" },
  });

  return {
    totalIssued,
    totalPurchased,
    balance: totalIssued - totalPurchased,
    pendingReview,
    cancelled,
    receiptCount: postedReceipts.length,
    lastPurchaseAt: lastPurchase?.postedAt ?? null,
  };
}

export async function issueAdvance(input: {
  purchaserId: string;
  amount: number;
  paymentMethod: "CASH" | "CARD" | "TRANSFER" | "OTHER";
  comment?: string;
  issuedById: string;
}) {
  if (input.amount <= 0) throw new Error("Сумма должна быть больше нуля");

  const purchaser = await prisma.user.findFirst({
    where: { id: input.purchaserId, role: "PURCHASER" },
  });
  if (!purchaser) throw new Error("Закупщик не найден");

  return prisma.purchaserAdvance.create({
    data: {
      purchaserId: input.purchaserId,
      amount: input.amount,
      paymentMethod: input.paymentMethod,
      comment: input.comment,
      issuedById: input.issuedById,
    },
  });
}
