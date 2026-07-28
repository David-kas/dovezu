import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PurchaserHomePage } from "@/components/purchaser/home-page";

export default async function PurchaserPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (!["PURCHASER", "ADMIN", "OPERATOR"].includes(role)) redirect("/login");

  return (
    <AppShell role="ADMIN" userName={session.user.name} purchaserMode={role === "PURCHASER"}>
      <PurchaserHomePage />
    </AppShell>
  );
}
