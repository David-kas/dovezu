/**
 * Сброс пароля администратора без полного seed.
 * Запуск: npx tsx scripts/set-admin.ts
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const ADMIN_LOGIN = "79626289777";
const ADMIN_PASSWORD = "btt7prF7";
const ADMIN_PHONE = "+79626289777";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hashPassword(ADMIN_PASSWORD);

  await prisma.user.deleteMany({
    where: { login: "admin", role: "ADMIN" },
  });

  const admin = await prisma.user.upsert({
    where: { login: ADMIN_LOGIN },
    update: {
      passwordHash,
      name: "Администратор",
      phone: ADMIN_PHONE,
      role: "ADMIN",
    },
    create: {
      login: ADMIN_LOGIN,
      passwordHash,
      role: "ADMIN",
      name: "Администратор",
      phone: ADMIN_PHONE,
    },
  });

  console.log(`Admin updated: login=${ADMIN_LOGIN}, id=${admin.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
