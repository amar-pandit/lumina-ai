import { getCurrentUser } from "@/lib/auth";
import { hasDatabaseRole } from "@/lib/academic-api";
import { getEmailHistory } from "@/lib/email-service";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (session.role !== "ADMIN") {
    return Response.json({ error: "Only Admin can view email history." }, { status: 403 });
  }

  try {
    if (process.env.DATABASE_URL?.trim() && !await hasDatabaseRole(session)) {
      return Response.json({ error: "Your account is not provisioned for email history access." }, { status: 403 });
    }
    const entries = await getEmailHistory();
    return Response.json({ entries }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Email history could not be read.", error);
    return Response.json({ error: "Email history is unavailable." }, { status: 500 });
  }
}
