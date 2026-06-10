import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { CourierOrdersPage } from "@/components/courier/orders-page";

export default async function CourierOrdersRoute() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "COURIER") redirect("/login");

  return (
    <AppShell role="COURIER" userName={session.user.name}>
      <CourierOrdersPage />
    </AppShell>
  );
}
