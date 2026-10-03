import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyTools } from "@/components/faculty/FacultyTools";

export default async function FacultyAttendanceGridPage() {
  await requireRouteAccess("/faculty/courses/demo/attendance-grid");
  return <FacultyTools tool="grid" />;
}
