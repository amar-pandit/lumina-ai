import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyTools } from "@/components/faculty/FacultyTools";

export default async function FacultyInterventionsPage() {
  await requireRouteAccess("/faculty/interventions");
  return <FacultyTools tool="interventions" />;
}
