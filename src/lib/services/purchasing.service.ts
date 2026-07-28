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

  const draftCount = await prisma.stockDocument.count({
    where: { purchaserId, status: "DRAFT", type: "RECEIPT" },
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
    draftCount,
    receiptCount: postedReceipts.length,
    lastPurchaseAt: lastPurchase?.postedAt ?? null,
  };
}

export async function listPurchasers() {
  const purchasers = await prisma.user.findMany({
    where: { role: "PURCHASER" },
    select: { id: true, name: true, phone: true, login: true, createdAt: true },
    orderBy: { name: "asc" },
  });

  return Promise.all(
    purchasers.map(async (p) => ({
      ...p,
      ...(await getPurchaserSummary(p.id)),
    }))
  );
}

export async function getPurchaserDetail(purchaserId: string) {
  const purchaser = await prisma.user.findFirst({
    where: { id: purchaserId, role: "PURCHASER" },
    select: { id: true, name: true, phone: true, login: true, createdAt: true },
  });
  if (!purchaser) throw new Error("Закупщик не найден");

  const summary = await getPurchaserSummary(purchaserId);

  const advances = await prisma.purchaserAdvance.findMany({
    where: { purchaserId },
    orderBy: { issuedAt: "desc" },
    take: 50,
    include: { issuedBy: { select: { name: true } } },
  });

  const documents = await prisma.stockDocument.findMany({
    where: { purchaserId, type: "RECEIPT" },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      number: true,
      status: true,
      createdAt: true,
      postedAt: true,
      totalPurchaseCost: true,
      linesTotal: true,
      supplier: { select: { name: true } },
    },
  });

  return {
    purchaser,
    summary,
    advances: advances.map((a) => ({
      id: a.id,
      amount: decimalToNumber(a.amount),
      issuedAt: a.issuedAt,
      paymentMethod: a.paymentMethod,
      comment: a.comment,
      issuedBy: a.issuedBy,
    })),
    documents: documents.map((d) => ({
      id: d.id,
      number: d.number,
      status: d.status,
      createdAt: d.createdAt,
      postedAt: d.postedAt,
      totalPurchaseCost: d.totalPurchaseCost ? decimalToNumber(d.totalPurchaseCost) : null,
      linesTotal: d.linesTotal ? decimalToNumber(d.linesTotal) : null,
      supplier: d.supplier,
    })),
  };
}

export async function listAdvances(purchaserId: string, limit = 50) {
  const advances = await prisma.purchaserAdvance.findMany({
    where: { purchaserId },
    orderBy: { issuedAt: "desc" },
    take: limit,
    include: { issuedBy: { select: { name: true } } },
  });

  return advances.map((a) => ({
    id: a.id,
    amount: decimalToNumber(a.amount),
    issuedAt: a.issuedAt,
    paymentMethod: a.paymentMethod,
    comment: a.comment,
    issuedBy: a.issuedBy,
  }));
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
    include: { issuedBy: { select: { name: true } } },
  });
}
