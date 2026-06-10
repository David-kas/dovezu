import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { TransfersPage } from "@/components/admin/transfers-page";

export default async function AdminTransfersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <TransfersPage />
    </AppShell>
  );
}
