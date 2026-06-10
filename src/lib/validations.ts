import { z } from "zod";

export const loginSchema = z.object({
  login: z.string().min(1, "Введите логин"),
  password: z.string().min(1, "Введите пароль"),
});

export const courierLoginSchema = z.object({
  identifier: z.string().min(1, "Введите телефон или Telegram"),
  password: z.string().min(1, "Введите пароль"),
});

export const productSchema = z.object({
  name: z.string().min(1, "Введите наименование"),
  category: z.string().min(1, "Введите категорию"),
  purchasePrice: z.coerce.number().min(0, "Цена не может быть отрицательной"),
  salePrice: z.coerce.number().min(0, "Цена не может быть отрицательной"),
  centralStock: z.coerce.number().int().min(0).default(0),
  imageUrl: z.string().url().optional().or(z.literal("")),
  status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

export const courierSchema = z.object({
  name: z.string().min(1, "Введите имя"),
  phone: z.string().optional(),
  telegram: z.string().optional(),
  login: z.string().min(3, "Логин минимум 3 символа"),
  password: z.string().min(6, "Пароль минимум 6 символов").optional(),
  telegramChatId: z.string().optional(),
});

export const transferSchema = z.object({
  courierId: z.string().min(1),
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1, "Минимум 1"),
  note: z.string().optional(),
});

export const orderItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
});

export const orderSchema = z.object({
  clientName: z.string().min(1, "Введите имя клиента"),
  clientPhone: z.string().min(1, "Введите телефон"),
  address: z.string().min(1, "Введите адрес"),
  comment: z.string().optional(),
  courierId: z.string().optional(),
  items: z.array(orderItemSchema).min(1, "Добавьте хотя бы один товар"),
});

export const orderStatusSchema = z.enum([
  "NEW",
  "ASSIGNED",
  "IN_TRANSIT",
  "COMPLETED",
  "CANCELLED",
]);

export const locationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().optional(),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
});
