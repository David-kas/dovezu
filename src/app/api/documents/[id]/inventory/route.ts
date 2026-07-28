import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess, canPostDocuments } from "@/lib/api-auth";
import {
  getInventoryState,
  fillInventoryFromWarehouse,
  upsertInventoryLine,
  incrementInventoryLine,
  removeInventoryLine,
} from "@/lib/services/inventory-document.service";
import { postDocument } from "@/lib/services/document-posting.service";
import { getRequestMeta } from "@/lib/services/audit.service";
import type { Role } from "@prisma/client";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const { id } = await params;
  try {
    const state = await getInventoryState(id);
    return jsonSuccess(state);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Not found", 404);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error, user } = await requireAuth(["ADMIN", "OPERATOR"]);
  if (error) return error;

  const { id } = await params;
  const body = await req.json();

  try {
    if (body.action === "fill-from-warehouse") {
      const result = await fillInventoryFromWarehouse(id);
      const state = await getInventoryState(id);
      return jsonSuccess({ ...result, ...state });
    }

    if (body.action === "set-line") {
      if (!body.productId) return jsonError("productId required");
      const line = await upsertInventoryLine(id, body.productId, body.quantity ?? 0);
      const state = await getInventoryState(id);
      return jsonSuccess({ line, ...state });
    }

    if (body.action === "increment-line") {
      if (!body.productId) return jsonError("productId required");
      const line = await incrementInventoryLine(id, body.productId, body.delta ?? 1);
      const state = await getInventoryState(id);
      return jsonSuccess({ line, ...state });
    }

    if (body.action === "remove-line") {
      if (!body.lineId) return jsonError("lineId required");
      await removeInventoryLine(id, body.lineId);
      const state = await getInventoryState(id);
      return jsonSuccess(state);
    }

    if (body.action === "post") {
      if (!canPostDocuments(user!.role as Role)) {
        return jsonError("Forbidden", 403);
      }
      const meta = getRequestMeta(req);
      const doc = await postDocument(id, user!.id, user!.role as Role, meta);
      return jsonSuccess(doc);
    }

    return jsonError("Unknown action");
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Failed");
  }
}
