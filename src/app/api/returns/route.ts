import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, jsonError, jsonSuccess } from "@/lib/api-auth";
import { returnStockSchema } from "@/lib/validations";
import { returnFromCourier, returnAllFromCourier } from "@/lib/orders";
import { logAudit, getClientIp } from "@/lib/audit";

export async function POST(req: NextRequest) {
  const { error, user } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const body = await req.json();
  const parsed = returnStockSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(parsed.error.errors[0]?.message || "Validation error");
  }

  const { courierId, returnAll, items } = parsed.data;
  const ipAddress = getClientIp(req);

  try {
    if (returnAll) {
      const result = await returnAllFromCourier(courierId, user!.id);

      await logAudit({
        action: "RETURN_ALL_STOCK",
        adminId: user!.id,
        courierId,
        quantity: result.totalQuantity,
        details: `Возвращено позиций: ${result.returned}`,
        ipAddress,
      });

      return jsonSuccess({
        message: "Все товары успешно возвращены на Центральный склад",
        ...result,
      });
    }

    if (!items || items.length === 0) {
      return jsonError("Укажите товары для возврата или выберите «Вернуть всё»");
    }

    const result = await returnFromCourier(courierId, items, user!.id);
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    for (const item of items) {
      await logAudit({
        action: "RETURN_STOCK",
        adminId: user!.id,
        courierId,
        productId: item.productId,
        quantity: item.quantity,
        ipAddress,
      });
    }

    return jsonSuccess({
      message: "Товары успешно возвращены на Центральный склад",
      ...result,
      totalQuantity: totalQty,
    });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Return failed");
  }
}

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const courierId = searchParams.get("courierId");
  if (!courierId) return jsonError("courierId required");

  const stock = await prisma.courierStock.findMany({
    where: { courierId, quantity: { gt: 0 } },
    include: { product: { select: { id: true, name: true, salePrice: true } } },
    orderBy: { product: { name: "asc" } },
  });

  const mapped = stock.map((s) => ({
    id: s.id,
    productId: s.productId,
    productName: s.product.name,
    quantity: s.quantity,
    salePrice: Number(s.product.salePrice),
  }));

  return jsonSuccess(mapped);
}
