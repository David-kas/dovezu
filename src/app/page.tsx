import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getDefaultRoute } from "@/lib/permissions";
import type { Role } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  redirect(getDefaultRoute(session.user.role as Role));
}
