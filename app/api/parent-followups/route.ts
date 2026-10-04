import { getCurrentUser } from "@/lib/auth";
import { handleAcademicGet, handleAcademicPost } from "@/lib/academic-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  return handleAcademicGet(request, await getCurrentUser(), "parent-followups");
}

export async function POST(request: Request) {
  return handleAcademicPost(request, await getCurrentUser(), "parent-followups");
}
