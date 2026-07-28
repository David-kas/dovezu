import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess, canCreateReceipts, canPostDocuments } from "@/lib/api-auth";
import { createReceiptDocument, submitForReview } from "@/lib/services/receipt.service";
import { postDocument } from "@/lib/services/document-posting.service";
import { getCentralWarehouse } from "@/lib/services/inventory.service";
import { getRequestMeta } from "@/lib/services/audit.service";
import { z } from "zod";
import type { Role } from "@prisma/client";

const createReceiptSchema = z.object({
  supplierId: z.string().optional(),
  toWarehouseId: z.string().optional(),
  purchaseDate: z.string().optional(),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "OTHER"]).optional(),
  receiptNumber: z.string().optional(),
  receiptTotal: z.coerce.number().optional(),
  comment: z.string().optional(),
  lines: z
    .array(
      z.object({
        productId: z.string().optional(),
        quantity: z.coerce.number().int().min(1),
        purchasePrice: z.coerce.number().min(0).optional(),
        receiptLineText: z.string().optional(),
      })
    )
    .optional(),
});

export async function GET(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "RECEIPT";
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);

  const documents = await prisma.stockDocument.findMany({
    where: {
      type: type as "RECEIPT",
      ...(status ? { status: status as "DRAFT" | "REVIEW" | "POSTED" | "CANCELLED" } : {}),
      ...(user!.role === "PURCHASER" ? { purchaserId: user!.id } : {}),
    },
    include: {
      supplier: true,
      author: { select: { id: true, name: true } },
      purchaser: { select: { id: true, name: true } },
      toWarehouse: true,
      lines: { include: { product: true } },
      _count: { select: { attachments: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return jsonSuccess(documents);
}

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  if (!canCreateReceipts(user!.role as Role)) {
    return jsonError("Forbidden", 403);
  }

  const body = await req.json();
  const parsed = createReceiptSchema.safeParse(body);
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Validation error");

  const central = await getCentralWarehouse();
  const meta = getRequestMeta(req);

  try {
    const doc = await createReceiptDocument({
      authorId: user!.id,
      authorRole: user!.role as Role,
      purchaserId: user!.role === "PURCHASER" ? user!.id : undefined,
      supplierId: parsed.data.supplierId,
      toWarehouseId: parsed.data.toWarehouseId ?? central.id,
      purchaseDate: parsed.data.purchaseDate ? new Date(parsed.data.purchaseDate) : undefined,
      paymentMethod: parsed.data.paymentMethod,
      receiptNumber: parsed.data.receiptNumber,
      receiptTotal: parsed.data.receiptTotal,
      comment: parsed.data.comment,
      lines: parsed.data.lines,
      meta,
    });
    return jsonSuccess(doc, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Create failed");
  }
}

export async function PATCH(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const body = await req.json();
  const { documentId, action, discrepancyReason } = body;
  if (!documentId || !action) return jsonError("documentId and action required");

  const meta = getRequestMeta(req);

  try {
    if (action === "submit-review") {
      const doc = await submitForReview(documentId, user!.id, user!.role as Role);
      return jsonSuccess(doc);
    }

    if (action === "post") {
      if (!canPostDocuments(user!.role as Role)) {
        return jsonError("Только ADMIN или OPERATOR может провести документ", 403);
      }
      const doc = await postDocument(documentId, user!.id, user!.role as Role, {
        ...meta,
        discrepancyReason,
      });
      return jsonSuccess(doc);
    }

    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Action failed");
  }
}
