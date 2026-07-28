import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { matchLineToProduct, excludeLine } from "@/lib/services/receipt.service";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; lineId: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const { id: documentId, lineId } = await params;
  const body = await req.json();

  const line = await prisma.stockDocumentLine.findUnique({
    where: { id: lineId },
    include: { document: true },
  });
  if (!line || line.documentId !== documentId) return jsonError("Строка не найдена", 404);
  if (user!.role === "PURCHASER" && line.document.purchaserId !== user!.id) {
    return jsonError("Forbidden", 403);
  }

  try {
    if (body.action === "match" && body.productId) {
      const updated = await matchLineToProduct(
        lineId,
        body.productId,
        user!.id,
        user!.role as Role,
        { supplierId: line.document.supplierId ?? undefined }
      );
      return jsonSuccess(updated);
    }

    if (body.action === "exclude") {
      const updated = await excludeLine(lineId, user!.id, user!.role as Role);
      return jsonSuccess(updated);
    }

    if (body.action === "update") {
      if (line.document.status === "POSTED") return jsonError("Документ проведён");
      const updated = await prisma.stockDocumentLine.update({
        where: { id: lineId },
        data: {
          quantity: body.quantity ?? line.quantity,
          purchasePrice: body.purchasePrice ?? line.purchasePrice,
          lineTotal:
            body.purchasePrice != null && body.quantity != null
              ? body.quantity * body.purchasePrice
              : undefined,
        },
      });
      return jsonSuccess(updated);
    }

    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed");
  }
}
