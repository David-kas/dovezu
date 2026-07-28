import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "receipts");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
];

export function isAllowedMimeType(mimeType: string): boolean {
  return ALLOWED_TYPES.includes(mimeType) || mimeType.startsWith("image/");
}

export async function saveReceiptFile(
  documentId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ fileUrl: string; fileName: string }> {
  if (buffer.length > MAX_SIZE) {
    throw new Error("Файл слишком большой (макс. 10 МБ)");
  }
  if (!isAllowedMimeType(mimeType)) {
    throw new Error("Неподдерживаемый формат. Используйте JPG, PNG или PDF");
  }

  const ext = path.extname(originalName) || (mimeType === "application/pdf" ? ".pdf" : ".jpg");
  const safeName = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_DIR, documentId);
  await mkdir(dir, { recursive: true });

  const fullPath = path.join(dir, safeName);
  await writeFile(fullPath, buffer);

  const fileUrl = `/uploads/receipts/${documentId}/${safeName}`;
  return { fileUrl, fileName: originalName || safeName };
}

/** Fallback for serverless: store small files as data URL */
export function toDataUrl(buffer: Buffer, mimeType: string): string {
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function saveReceiptFileSafe(
  documentId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ fileUrl: string; fileName: string }> {
  try {
    return await saveReceiptFile(documentId, buffer, originalName, mimeType);
  } catch {
    if (buffer.length <= 2 * 1024 * 1024) {
      return { fileUrl: toDataUrl(buffer, mimeType), fileName: originalName };
    }
    throw new Error("Не удалось сохранить файл");
  }
}
