import { requireAuth, jsonSuccess } from "@/lib/api-auth";
import { getCentralWarehouse, migrateExistingStockToWarehouses } from "@/lib/services/inventory.service";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { error } = await requireAuth(["ADMIN", "OPERATOR", "PURCHASER"]);
  if (error) return error;

  await getCentralWarehouse();
  const warehouses = await prisma.warehouse.findMany({
    where: { isActive: true },
    include: {
      courier: { select: { id: true, name: true } },
      _count: { select: { stock: true } },
    },
    orderBy: { name: "asc" },
  });

  return jsonSuccess(warehouses);
}

export async function POST() {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  await migrateExistingStockToWarehouses();
  return jsonSuccess({ migrated: true });
}
