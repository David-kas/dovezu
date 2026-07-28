import { NextRequest } from "next/server";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { lookupBarcode, bindBarcode, debounceScan } from "@/lib/services/barcode.service";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const barcode = new URL(req.url).searchParams.get("code");
  if (!barcode) return jsonError("code required");

  const sessionKey = req.headers.get("x-scan-session") ?? "default";
  if (!debounceScan(sessionKey, barcode)) {
    return jsonSuccess({ debounced: true });
  }

  const result = await lookupBarcode(barcode);
  if (!result) return jsonSuccess({ found: false, barcode });

  return jsonSuccess({
    found: true,
    barcode: result.barcode,
    product: result.product,
  });
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  const body = await req.json();
  const { productId, barcode, isPrimary } = body;
  if (!productId || !barcode) return jsonError("productId and barcode required");

  try {
    const record = await bindBarcode(productId, barcode, isPrimary ?? false);
    return jsonSuccess(record, 201);
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Bind failed");
  }
}
