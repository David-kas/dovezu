import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PurchaserDetailPage } from "@/components/admin/purchaser-detail-page";

export default async function AdminPurchaserDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) redirect("/login");

  const { id } = await params;

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <PurchaserDetailPage purchaserId={id} canIssueAdvance={session.user.role === "ADMIN"} />
    </AppShell>
  );
}
