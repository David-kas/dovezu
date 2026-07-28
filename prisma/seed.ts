import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

const ADMIN_LOGIN = "79626289777";
const ADMIN_PASSWORD = "btt7prF7";
const ADMIN_PHONE = "+79626289777";

async function main() {
  const adminPassword = await hashPassword(ADMIN_PASSWORD);
  const courierPassword = await hashPassword("courier123");

  // Удаляем старый демо-аккаунт admin/admin123
  await prisma.user.deleteMany({
    where: { login: "admin", role: "ADMIN" },
  });

  const admin = await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {
      passwordHash: adminPassword,
      name: "Администратор",
      phone: ADMIN_PHONE,
      role: "ADMIN",
    },
    create: {
      login: ADMIN_LOGIN,
      passwordHash: adminPassword,
      role: "ADMIN",
      name: "Администратор",
      phone: ADMIN_PHONE,
    },
  });

  const courier = await prisma.user.upsert({
    where: { login: "courier1" },
    update: {},
    create: {
      login: "courier1",
      passwordHash: courierPassword,
      role: "COURIER",
      name: "Иван Курьеров",
      phone: "+79001234567",
      telegram: "ivan_courier",
      telegramChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || null,
      qrToken: "demo-qr-token-change-in-production",
    },
  });

  const products = [
    { name: "Вода 19л", category: "Напитки", purchasePrice: 150, salePrice: 350, centralStock: 100 },
    { name: "Хлеб белый", category: "Выпечка", purchasePrice: 35, salePrice: 65, centralStock: 50 },
    { name: "Молоко 1л", category: "Молочные", purchasePrice: 55, salePrice: 95, centralStock: 80 },
    { name: "Яйца 10шт", category: "Молочные", purchasePrice: 80, salePrice: 130, centralStock: 40 },
    { name: "Сок 1л", category: "Напитки", purchasePrice: 70, salePrice: 120, centralStock: 60 },
  ];

  for (const p of products) {
    const id = `seed-${p.name.replace(/\s+/g, "-").toLowerCase()}`;
    await prisma.product.upsert({
      where: { id },
      update: {},
      create: {
        id,
        ...p,
        status: "ACTIVE",
      },
    });
  }

  console.log("Seed completed:");
  console.log(`  Admin: login=${ADMIN_LOGIN}, password=${ADMIN_PASSWORD} (id: ${admin.id})`);
  console.log(`  Courier: login=courier1 / phone=+79001234567 / @ivan_courier, password=courier123 (id: ${courier.id})`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
