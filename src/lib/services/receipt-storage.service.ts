import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomBytes } from "crypto";

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "receipts");
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
/** Лимит тела запроса на Vercel ~4.5 MB — data URL храним в БД */
const VERCEL_DATA_URL_MAX = 4 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
];

function isServerless(): boolean {
  return !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function isAllowedMimeType(mimeType: string): boolean {
  if (!mimeType) return true;
  return ALLOWED_TYPES.includes(mimeType) || mimeType.startsWith("image/");
}

export function normalizeMimeType(mimeType: string, fileName: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  const ext = path.extname(fileName).toLowerCase();
  if (ext === ".pdf") return "application/pdf";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic" || ext === ".heif") return "image/heic";
  return "image/jpeg";
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
  const normalizedMime = normalizeMimeType(mimeType, originalName);
  if (!isAllowedMimeType(normalizedMime)) {
    throw new Error("Неподдерживаемый формат. Используйте JPG, PNG или PDF");
  }

  const ext = path.extname(originalName) || (normalizedMime === "application/pdf" ? ".pdf" : ".jpg");
  const safeName = `${Date.now()}-${randomBytes(4).toString("hex")}${ext}`;
  const dir = path.join(UPLOAD_DIR, documentId);
  await mkdir(dir, { recursive: true });

  const fullPath = path.join(dir, safeName);
  await writeFile(fullPath, buffer);

  const fileUrl = `/uploads/receipts/${documentId}/${safeName}`;
  return { fileUrl, fileName: originalName || safeName };
}

/** Fallback for serverless: store files as data URL in DB */
export function toDataUrl(buffer: Buffer, mimeType: string): string {
  const normalizedMime = normalizeMimeType(mimeType, "");
  return `data:${normalizedMime || "image/jpeg"};base64,${buffer.toString("base64")}`;
}

export async function saveReceiptFileSafe(
  documentId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string
): Promise<{ fileUrl: string; fileName: string }> {
  const normalizedMime = normalizeMimeType(mimeType, originalName);

  if (buffer.length > MAX_SIZE) {
    throw new Error("Файл слишком большой (макс. 10 МБ)");
  }
  if (!isAllowedMimeType(normalizedMime)) {
    throw new Error("Неподдерживаемый формат. Используйте JPG, PNG или PDF");
  }

  if (isServerless()) {
    if (buffer.length > VERCEL_DATA_URL_MAX) {
      throw new Error(
        "Фото слишком большое для загрузки (макс. ~4 МБ). Сделайте снимок меньшего размера или выберите «Галерея» — приложение сожмёт изображение."
      );
    }
    return { fileUrl: toDataUrl(buffer, normalizedMime), fileName: originalName || "receipt" };
  }

  try {
    return await saveReceiptFile(documentId, buffer, originalName, normalizedMime);
  } catch {
    if (buffer.length <= VERCEL_DATA_URL_MAX) {
      return { fileUrl: toDataUrl(buffer, normalizedMime), fileName: originalName || "receipt" };
    }
    throw new Error("Не удалось сохранить файл");
  }
}
