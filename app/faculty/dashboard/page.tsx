import { FacultyDashboardPage } from "@/components/faculty/FacultyDashboardPage";
import { requireRouteAccess } from "@/lib/require-route-access";

export default async function FacultyDashboardRoute() {
  await requireRouteAccess("/faculty/dashboard");
  return <FacultyDashboardPage />;
}
