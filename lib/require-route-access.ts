import { redirect } from "next/navigation";
import { dashboardForRole, getCurrentUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/auth-types";

export async function requireRouteAccess(pathname: string): Promise<void> {
  const session = await getCurrentUser();
  if (!session) redirect("/auth");
  if (!canAccessRoute(session.role, pathname)) redirect(dashboardForRole(session.role));
}
