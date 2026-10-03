import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyGradebook } from "@/components/faculty/FacultyGradebook";

export default async function FacultyGradebookPage() {
  await requireRouteAccess("/faculty/courses/demo/gradebook");
  return <FacultyGradebook />;
}
