/**
 * OCR service — ключи API только на сервере (RECEIPT_OCR_API_URL, RECEIPT_OCR_API_KEY).
 * Без ключей возвращает заглушку для ручной проверки.
 */

export interface OcrLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  barcode?: string;
}

export interface OcrReceiptResult {
  storeName?: string;
  inn?: string;
  receiptDate?: string;
  receiptTime?: string;
  receiptNumber?: string;
  totalAmount?: number;
  discount?: number;
  lines: OcrLineItem[];
  rawJson: string;
}

export async function processReceiptFile(
  fileBuffer: Buffer,
  mimeType: string
): Promise<OcrReceiptResult> {
  const apiUrl = process.env.RECEIPT_OCR_API_URL;
  const apiKey = process.env.RECEIPT_OCR_API_KEY;

  if (apiUrl && apiKey) {
    const formData = new FormData();
    formData.append("file", new Blob([new Uint8Array(fileBuffer)], { type: mimeType }));
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });
    if (!res.ok) throw new Error("OCR service error");
    const data = await res.json();
    return data as OcrReceiptResult;
  }

  return {
    lines: [],
    rawJson: JSON.stringify({
      stub: true,
      message: "OCR не настроен — добавьте RECEIPT_OCR_API_URL или введите строки вручную на экране проверки",
      mimeType,
      size: fileBuffer.length,
    }),
  };
}

/** Demo parser for development when OCR API is not configured */
export function parseManualOcrPayload(body: {
  storeName?: string;
  inn?: string;
  receiptNumber?: string;
  totalAmount?: number;
  lines?: OcrLineItem[];
}): OcrReceiptResult {
  return {
    storeName: body.storeName,
    inn: body.inn,
    receiptNumber: body.receiptNumber,
    totalAmount: body.totalAmount,
    lines: body.lines ?? [],
    rawJson: JSON.stringify(body),
  };
}
