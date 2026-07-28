import { prisma } from "@/lib/prisma";
import { requireAuth, jsonSuccess } from "@/lib/api-auth";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const [reviewDocs, unmatchedLines, discrepancyDocs] = await Promise.all([
    prisma.stockDocument.findMany({
      where: { status: "REVIEW", type: "RECEIPT" },
      include: {
        purchaser: { select: { name: true } },
        supplier: { select: { name: true } },
        _count: { select: { lines: true, attachments: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
    prisma.stockDocumentLine.findMany({
      where: {
        matchConfidence: "UNMATCHED",
        excluded: false,
        document: { status: { in: ["DRAFT", "REVIEW"] } },
      },
      include: {
        document: { select: { id: true, number: true, status: true } },
      },
      take: 50,
    }),
    prisma.stockDocument.findMany({
      where: {
        status: "REVIEW",
        type: "RECEIPT",
        NOT: { discrepancyReason: null },
      },
      take: 20,
    }),
  ]);

  return jsonSuccess({
    reviewDocs,
    unmatchedLines,
    discrepancyDocs,
    counts: {
      review: reviewDocs.length,
      unmatched: unmatchedLines.length,
      discrepancy: discrepancyDocs.length,
    },
  });
}
