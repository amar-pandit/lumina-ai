import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyTools } from "@/components/faculty/FacultyTools";

export default async function FacultyRemedialPage() {
  await requireRouteAccess("/faculty/courses/demo/remedial");
  return <FacultyTools tool="remedial" />;
}
