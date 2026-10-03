import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyTools } from "@/components/faculty/FacultyTools";

export default async function FacultyCurriculumHeatmapPage() {
  await requireRouteAccess("/faculty/courses/demo/heatmap");
  return <FacultyTools tool="heatmap" />;
}
