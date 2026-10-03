import { requireRouteAccess } from "@/lib/require-route-access";
import { FacultyTools } from "@/components/faculty/FacultyTools";

export default async function FacultyVoiceEntryPage() {
  await requireRouteAccess("/faculty/voice-entry");
  return <FacultyTools tool="voice" />;
}
