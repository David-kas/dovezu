import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { CourierStockPage } from "@/components/courier/stock-page";
import { LocationTracker } from "@/components/courier/location-tracker";
import { PushNotifications } from "@/components/courier/push-notifications";

export default async function CourierPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "COURIER") redirect("/login");

  return (
    <AppShell role="COURIER" userName={session.user.name}>
      <LocationTracker />
      <PushNotifications />
      <CourierStockPage />
    </AppShell>
  );
}
