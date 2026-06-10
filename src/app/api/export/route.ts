import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/api-auth";
import { exportToExcel } from "@/lib/excel";
import { decimalToNumber, ORDER_STATUS_LABELS, MOVEMENT_TYPE_LABELS } from "@/lib/utils";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth(["ADMIN"]);
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "orders";

  if (type === "orders") {
    const orders = await prisma.order.findMany({
      include: {
        items: { include: { product: true } },
        courier: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = orders.map((o) => ({
      "№ заказа": o.orderNumber,
      Клиент: o.clientName,
      Телефон: o.clientPhone,
      Адрес: o.address,
      Статус: ORDER_STATUS_LABELS[o.status] || o.status,
      Курьер: o.courier?.name || "—",
      Сумма: decimalToNumber(o.totalAmount),
      Дата: o.createdAt.toISOString(),
    }));

    const buffer = exportToExcel(data, "Заказы", "orders");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="orders.xlsx"',
      },
    });
  }

  if (type === "products") {
    const products = await prisma.product.findMany({ orderBy: { name: "asc" } });
    const data = products.map((p) => ({
      Наименование: p.name,
      Категория: p.category,
      "Закупочная цена": decimalToNumber(p.purchasePrice),
      "Цена продажи": decimalToNumber(p.salePrice),
      "Центральный склад": p.centralStock,
      Статус: p.status,
    }));

    const buffer = exportToExcel(data, "Товары", "products");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="products.xlsx"',
      },
    });
  }

  if (type === "movements") {
    const movements = await prisma.stockMovement.findMany({
      include: {
        product: true,
        fromCourier: { select: { name: true } },
        toCourier: { select: { name: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = movements.map((m) => ({
      Дата: m.createdAt.toISOString(),
      Тип: MOVEMENT_TYPE_LABELS[m.type] || m.type,
      Товар: m.product.name,
      Количество: m.quantity,
      От: m.fromCourier?.name || "Центральный склад",
      К: m.toCourier?.name || "—",
      Заказ: m.order ? `#${m.order.orderNumber}` : "—",
      Примечание: m.note || "",
    }));

    const buffer = exportToExcel(data, "Движения", "movements");
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="movements.xlsx"',
      },
    });
  }

  return NextResponse.json({ error: "Unknown export type" }, { status: 400 });
}
