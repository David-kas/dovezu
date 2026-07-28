import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { InventoryListPage } from "@/components/admin/inventory-list-page";

export default async function AdminInventoryPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <InventoryListPage />
    </AppShell>
  );
}
