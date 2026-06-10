"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  Package,
  Users,
  ArrowRightLeft,
  ShoppingCart,
  BarChart3,
  History,
  MapPin,
  LogOut,
  Menu,
  X,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const adminNav = [
  { href: "/admin", label: "Дашборд", icon: LayoutDashboard },
  { href: "/admin/products", label: "Товары", icon: Package },
  { href: "/admin/couriers", label: "Курьеры", icon: Users },
  { href: "/admin/transfers", label: "Передача", icon: ArrowRightLeft },
  { href: "/admin/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/admin/movements", label: "Движения", icon: History },
  { href: "/admin/analytics", label: "Аналитика", icon: BarChart3 },
  { href: "/admin/map", label: "Карта", icon: MapPin },
];

const courierNav = [
  { href: "/courier", label: "Мой склад", icon: Package },
  { href: "/courier/orders", label: "Заказы", icon: ShoppingCart },
  { href: "/courier/history", label: "История", icon: History },
];

interface AppShellProps {
  children: React.ReactNode;
  role: "ADMIN" | "COURIER";
  userName?: string | null;
}

export function AppShell({ children, role, userName }: AppShellProps) {
  const pathname = usePathname();
  const nav = role === "ADMIN" ? adminNav : courierNav;
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <Link href={role === "ADMIN" ? "/admin" : "/courier"} className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Truck className="h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight">Dovezu</span>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            {userName && (
              <span className="hidden text-sm text-muted-foreground sm:inline">{userName}</span>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-30 w-64 transform border-r bg-background pt-16 transition-transform lg:static lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="flex flex-col gap-1 p-4">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || (item.href !== "/admin" && item.href !== "/courier" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        {mobileOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
