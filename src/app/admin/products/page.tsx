import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { ProductsPage } from "@/components/admin/products-page";

export default async function AdminProductsPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <ProductsPage />
    </AppShell>
  );
}
