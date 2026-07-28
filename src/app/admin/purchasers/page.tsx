import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PurchasersPage } from "@/components/admin/purchasers-page";

export default async function AdminPurchasersPage() {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <PurchasersPage />
    </AppShell>
  );
}
