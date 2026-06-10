"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";

interface StockItem {
  productName: string;
  quantity: number;
  salePrice: number;
}

export function CourierStockPage() {
  const [stock, setStock] = useState<StockItem[]>([]);

  useEffect(() => {
    fetch("/api/courier-stock").then((r) => r.json()).then(setStock);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Мой склад</h1>
        <p className="text-muted-foreground">Товары на вашем складе</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {stock.map((item, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <h3 className="font-semibold">{item.productName}</h3>
              <div className="mt-2 flex justify-between text-sm">
                <span className="text-muted-foreground">Остаток</span>
                <span className="font-medium">{item.quantity} шт.</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Цена продажи</span>
                <span>{formatCurrency(item.salePrice)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
        {stock.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">
            На вашем складе пока нет товаров
          </p>
        )}
      </div>
    </div>
  );
}
