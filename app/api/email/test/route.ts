import { getCurrentUser } from "@/lib/auth";
import { sendDevelopmentTestEmail } from "@/lib/email-service";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getCurrentUser();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return Response.json({ error: "Only Admin can send a test email." }, { status: 403 });
  }

  const timestamp = new Date().toISOString();
  try {
    const result = await sendDevelopmentTestEmail();
    return Response.json(result, {
      status: result.success ? 200 : 502,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Test email failed.";
    console.error("Development test email failed.", errorMessage);
    return Response.json({
      success: false,
      recipient: process.env.ADMIN_EMAIL ?? "",
      timestamp,
      errorMessage,
    }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
