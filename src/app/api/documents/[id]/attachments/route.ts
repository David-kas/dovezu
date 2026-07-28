import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { uploadAndProcessReceipt, matchOcrLine, recalcDocumentTotals } from "@/lib/services/receipt.service";
import { parseManualOcrPayload } from "@/lib/services/receipt-ocr.service";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/services/audit.service";
import type { Role } from "@prisma/client";

async function assertDocAccess(documentId: string, userId: string, role: Role) {
  const doc = await prisma.stockDocument.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Документ не найден");
  if (role === "PURCHASER" && doc.purchaserId !== userId) throw new Error("Forbidden");
  if (doc.status === "POSTED" || doc.status === "CANCELLED") {
    throw new Error("Документ нельзя изменить");
  }
  return doc;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id: documentId } = await params;

  try {
    await assertDocAccess(documentId, user!.id, user!.role as Role);

    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await req.json();
      if (body.action === "manual-ocr") {
        const ocr = parseManualOcrPayload(body);
        const { fileUrl, fileName } = body.fileName
          ? { fileUrl: body.fileUrl ?? "", fileName: body.fileName }
          : { fileUrl: "", fileName: "manual-entry" };

        if (body.fileUrl) {
          await prisma.documentAttachment.create({
            data: {
              documentId,
              fileName,
              fileUrl: body.fileUrl,
              mimeType: body.mimeType ?? "application/octet-stream",
            },
          });
        }

        await prisma.receiptOcrResult.create({
          data: {
            documentId,
            rawJson: ocr.rawJson,
            storeName: ocr.storeName,
            inn: ocr.inn,
            receiptNumber: ocr.receiptNumber,
            totalAmount: ocr.totalAmount,
          },
        });

        if (ocr.totalAmount != null) {
          await prisma.stockDocument.update({
            where: { id: documentId },
            data: { receiptTotal: ocr.totalAmount, receiptNumber: ocr.receiptNumber },
          });
        }

        const matchedLines = [];
        for (const item of ocr.lines) {
          const match = await matchOcrLine(item);
          matchedLines.push(match);
          await prisma.stockDocumentLine.create({
            data: {
              documentId,
              productId: match.productId,
              quantity: match.quantity,
              purchasePrice: match.unitPrice,
              lineTotal: match.lineTotal,
              receiptLineText: match.receiptText,
              matchConfidence: match.confidence,
            },
          });
        }

        await recalcDocumentTotals(documentId);

        return jsonSuccess({ matchedLines, ocr, needsReview: true });
      }
      return jsonError("Unknown action");
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) return jsonError("file required");

    const buffer = Buffer.from(await file.arrayBuffer());
    const pageNumber = parseInt(String(formData.get("pageNumber") ?? "1"), 10);

    const result = await uploadAndProcessReceipt(
      documentId,
      buffer,
      file.name,
      file.type || "application/octet-stream",
      user!.id,
      user!.role as Role,
      pageNumber
    );

    return jsonSuccess({
      ...result,
      needsReview: true,
      needsManualEntry: result.ocr.linesCount === 0,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Upload failed");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id: documentId } = await params;
  const attachmentId = new URL(req.url).searchParams.get("attachmentId");
  if (!attachmentId) return jsonError("attachmentId required");

  try {
    await assertDocAccess(documentId, user!.id, user!.role as Role);
    await prisma.documentAttachment.delete({ where: { id: attachmentId, documentId } });

    await logActivity({
      userId: user!.id,
      userRole: user!.role as Role,
      action: "RECEIPT_ATTACHMENT_DELETED",
      entityType: "StockDocument",
      entityId: documentId,
    });

    return jsonSuccess({ deleted: true });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Delete failed");
  }
}
