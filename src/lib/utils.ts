import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function formatDateShort(date: Date | string): string {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export const ORDER_STATUS_LABELS: Record<string, string> = {
  NEW: "Новый",
  ASSIGNED: "Назначен курьеру",
  IN_TRANSIT: "В пути",
  COMPLETED: "Выполнен",
  CANCELLED: "Отменён",
};

export const PRODUCT_STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Активен",
  INACTIVE: "Неактивен",
  ARCHIVED: "Архив",
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  TRANSFER_TO_COURIER: "Передача курьеру",
  ORDER_SALE: "Продажа по заказу",
  ORDER_RETURN: "Возврат по заказу",
  ADJUSTMENT: "Корректировка",
};

export function decimalToNumber(value: { toNumber?: () => number } | number | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return parseFloat(value);
  if (value && typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}
