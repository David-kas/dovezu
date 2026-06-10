import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { CouriersPage } from "@/components/admin/couriers-page";

export default async function AdminCouriersPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <CouriersPage />
    </AppShell>
  );
}
