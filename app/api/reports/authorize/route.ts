import { getCurrentUser } from "@/lib/auth";
import { canGenerateReport } from "@/lib/reports/access";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: "Authentication is required." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid report request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("reportType" in body) || typeof body.reportType !== "string") {
    return Response.json({ error: "Report type is required." }, { status: 400 });
  }
  if (!canGenerateReport(session.role, body.reportType)) {
    return Response.json({ error: "Your authenticated role cannot generate this report." }, { status: 403 });
  }
  return Response.json({ authorized: true }, { headers: { "Cache-Control": "private, no-store" } });
}
