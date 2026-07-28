import type { Role } from "@prisma/client";

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Администратор",
  OPERATOR: "Оператор",
  PURCHASER: "Закупщик",
  COURIER: "Курьер",
};

/** Может проводить складские документы */
export function canPostDocuments(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

/** Может создавать закупки / оприходования */
export function canCreateReceipts(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR" || role === "PURCHASER";
}

/** Полный доступ к финансам и настройкам */
export function canManageFinances(role: Role): boolean {
  return role === "ADMIN";
}

/** Доступ к админ-панели */
export function canAccessAdmin(role: Role): boolean {
  return role === "ADMIN" || role === "OPERATOR";
}

export function getDefaultRoute(role: Role): string {
  switch (role) {
    case "COURIER":
      return "/courier";
    case "PURCHASER":
      return "/purchaser";
    case "ADMIN":
    case "OPERATOR":
      return "/admin";
    default:
      return "/login";
  }
}
