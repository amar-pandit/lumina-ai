import { FacultyDashboardPage } from "@/components/faculty/FacultyDashboardPage";
import { requireRouteAccess } from "@/lib/require-route-access";

export default async function MentorDashboardPage() {
  await requireRouteAccess("/mentor/dashboard");
  return <FacultyDashboardPage workspace="Mentor" />;
}
