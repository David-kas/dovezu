"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function QrLoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("QR-код недействителен");
      return;
    }

    async function login() {
      const result = await signIn("qr-token", {
        token,
        redirect: false,
      });

      if (result?.error) {
        setError("QR-код недействителен или истёк");
        return;
      }

      router.push("/courier");
      router.refresh();
    }

    login();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Truck className="h-6 w-6" />
          </div>
          <CardTitle>Быстрый вход</CardTitle>
          <CardDescription>
            {error ? error : "Авторизация по QR-коду..."}
          </CardDescription>
        </CardHeader>
        {!error && (
          <CardContent>
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </CardContent>
        )}
      </Card>
    </div>
  );
}
