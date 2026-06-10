"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

const CourierMap = dynamic(() => import("./courier-map").then((m) => m.CourierMap), {
  ssr: false,
  loading: () => <div className="h-[500px] bg-muted animate-pulse rounded-xl" />,
});

interface CourierLocation {
  id: string;
  name: string;
  isOnline: boolean;
  lastSeenAt?: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
    createdAt: string;
  };
}

export function MapPage() {
  const [couriers, setCouriers] = useState<CourierLocation[]>([]);

  useEffect(() => {
    function load() {
      fetch("/api/location").then((r) => r.json()).then(setCouriers);
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Карта курьеров</h1>
        <p className="text-muted-foreground">Геолокация в реальном времени</p>
      </div>

      <CourierMap couriers={couriers} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {couriers.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{c.name}</h3>
                <Badge variant={c.isOnline ? "success" : "secondary"}>
                  {c.isOnline ? "Онлайн" : "Офлайн"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {c.location.latitude.toFixed(5)}, {c.location.longitude.toFixed(5)}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Обновлено: {formatDate(c.location.createdAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        {couriers.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-8">
            Нет данных о местоположении курьеров
          </p>
        )}
      </div>
    </div>
  );
}
