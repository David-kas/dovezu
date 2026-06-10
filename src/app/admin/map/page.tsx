import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { AppShell } from "@/components/layout/app-shell";
import { MapPage } from "@/components/admin/map-page";

export default async function AdminMapPage() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "ADMIN") redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name}>
      <MapPage />
    </AppShell>
  );
}
