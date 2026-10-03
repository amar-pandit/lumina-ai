import { getCurrentUser } from "@/lib/auth";
import { hasFaceIdentity } from "@/lib/face-auth/store";

export const runtime = "nodejs";

export async function GET() {
  const session = await getCurrentUser();
  if (!session) {
    return Response.json({ error: "Sign in before checking Face ID setup." }, { status: 401 });
  }
  return Response.json(
    { registered: hasFaceIdentity(session.user.id) },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
