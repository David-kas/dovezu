import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PurchaserReceiptPage } from "@/components/purchaser/receipt-page";

export default async function PurchaserReceiptRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { id } = await params;

  return (
    <AppShell role="ADMIN" userName={session.user.name} purchaserMode>
      <PurchaserReceiptPage documentId={id} />
    </AppShell>
  );
}
