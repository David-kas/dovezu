import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PurchaserReportPage } from "@/components/purchaser/report-page";

export default async function PurchaserReportRoute() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user.role;
  if (!["PURCHASER", "ADMIN", "OPERATOR"].includes(role)) redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name} purchaserMode={role === "PURCHASER"}>
      <PurchaserReportPage />
    </AppShell>
  );
}
