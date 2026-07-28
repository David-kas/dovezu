import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { InventoryDetailPage } from "@/components/admin/inventory-detail-page";

export default async function AdminInventoryDetailRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session || !["ADMIN", "OPERATOR"].includes(session.user.role)) redirect("/login");

  const { id } = await params;

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <InventoryDetailPage documentId={id} />
    </AppShell>
  );
}
