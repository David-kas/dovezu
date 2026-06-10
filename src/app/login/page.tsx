"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Truck, Shield, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { toast } from "@/hooks/use-toast";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleAdminLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const result = await signIn("admin-credentials", {
      login: form.get("login") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      toast({ title: "Ошибка", description: "Неверный логин или пароль", variant: "destructive" });
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  async function handleCourierLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    const result = await signIn("courier-credentials", {
      identifier: form.get("identifier") as string,
      password: form.get("password") as string,
      redirect: false,
    });

    setLoading(false);
    if (result?.error) {
      toast({ title: "Ошибка", description: "Неверные данные для входа", variant: "destructive" });
      return;
    }
    router.push("/courier");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
          <Truck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Dovezu</h1>
        <p className="text-muted-foreground mt-2">Система учёта доставок</p>
      </div>

      <Card className="w-full max-w-md glass">
        <CardHeader>
          <CardTitle>Вход в систему</CardTitle>
          <CardDescription>Выберите тип аккаунта</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="admin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="gap-2">
                <Shield className="h-4 w-4" />
                Админ
              </TabsTrigger>
              <TabsTrigger value="courier" className="gap-2">
                <User className="h-4 w-4" />
                Курьер
              </TabsTrigger>
            </TabsList>

            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-login">Логин</Label>
                  <Input id="admin-login" name="login" required autoComplete="username" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-password">Пароль</Label>
                  <Input id="admin-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Вход..." : "Войти как администратор"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="courier">
              <form onSubmit={handleCourierLogin} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="courier-identifier">Телефон или Telegram</Label>
                  <Input
                    id="courier-identifier"
                    name="identifier"
                    placeholder="+7... или @username"
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="courier-password">Пароль</Label>
                  <Input id="courier-password" name="password" type="password" required autoComplete="current-password" />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Вход..." : "Войти как курьер"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
