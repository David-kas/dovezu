import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess, canPostDocuments } from "@/lib/api-auth";
import { addDocumentLine } from "@/lib/services/receipt.service";
import { cancelDocument } from "@/lib/services/document-posting.service";
import { getRequestMeta } from "@/lib/services/audit.service";
import type { Role } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id } = await params;
  const doc = await prisma.stockDocument.findUnique({
    where: { id },
    include: {
      supplier: true,
      author: { select: { id: true, name: true } },
      postedBy: { select: { id: true, name: true } },
      purchaser: { select: { id: true, name: true } },
      fromWarehouse: true,
      toWarehouse: true,
      lines: { include: { product: true }, orderBy: { id: "asc" } },
      attachments: true,
      changeLogs: { orderBy: { createdAt: "desc" }, take: 50 },
      ocrResults: { orderBy: { processedAt: "desc" }, take: 1 },
    },
  });

  if (!doc) return jsonError("Документ не найден", 404);
  if (user!.role === "PURCHASER" && doc.purchaserId !== user!.id) {
    return jsonError("Forbidden", 403);
  }

  return jsonSuccess(doc);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  try {
    if (body.action === "add-line") {
      const line = await addDocumentLine(id, user!.id, user!.role as Role, {
        productId: body.productId,
        quantity: body.quantity ?? 1,
        purchasePrice: body.purchasePrice,
        receiptLineText: body.receiptLineText,
      });
      return jsonSuccess(line, 201);
    }

    if (body.action === "cancel") {
      if (!canPostDocuments(user!.role as Role)) {
        return jsonError("Forbidden", 403);
      }
      const meta = getRequestMeta(req);
      const doc = await cancelDocument(id, user!.id, user!.role as Role, meta);
      return jsonSuccess(doc);
    }

    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed");
  }
}
