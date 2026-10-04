import { getCurrentUser } from "@/lib/auth";
import { handleAcademicGet } from "@/lib/academic-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAcademicGet(request, await getCurrentUser(), "notification-events");
}
