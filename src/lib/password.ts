import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateQrToken(): string {
  return randomBytes(32).toString("hex");
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

export function normalizeTelegram(username: string): string {
  return username.replace(/^@/, "").toLowerCase();
}
