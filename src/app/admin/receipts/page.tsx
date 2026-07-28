import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ReceiptsPage } from "@/components/admin/receipts-page";

export default async function AdminReceiptsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !["ADMIN", "OPERATOR"].includes(session.user.role)) redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <ReceiptsPage />
    </AppShell>
  );
}
