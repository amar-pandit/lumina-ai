import { AdminSettings } from "@/components/admin/AdminModules";
import { dashboardForRole, getCurrentRole, hasRole } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminSettingsPage() {
  const role = await getCurrentRole();
  if (!role) redirect("/auth");
  if (!hasRole(role, ["ADMIN"])) redirect(dashboardForRole(role));

  return <AdminSettings />;
}
