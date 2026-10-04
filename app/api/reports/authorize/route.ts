import { getCurrentUser } from "@/lib/auth";
import { canGenerateReport } from "@/lib/reports/access";

export async function POST(request: Request) {
  try {
    const session = await getCurrentUser();
    if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid report request." }, { status: 400 });
    }
    if (typeof body !== "object" || body === null || !("reportType" in body) || typeof body.reportType !== "string") {
      return Response.json({ error: "Report type is required." }, { status: 400 });
    }
    const authorized = canGenerateReport(session.role, body.reportType);
    if (!authorized) {
      return Response.json({ error: "You do not have permission to export this report." }, { status: 403 });
    }
    return Response.json({ authorized: true }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Report authorization failed.", error);
    return Response.json({ error: "Report generation failed. Please try again." }, { status: 500 });
  }
}
