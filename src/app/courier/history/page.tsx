import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { CourierHistoryPage } from "@/components/courier/history-page";

export default async function CourierHistoryRoute() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "COURIER") redirect("/login");

  return (
    <AppShell role="COURIER" userName={session.user.name}>
      <CourierHistoryPage />
    </AppShell>
  );
}
