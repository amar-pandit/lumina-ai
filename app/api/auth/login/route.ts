import { login } from "@/lib/auth";
import type { DemoSession } from "@/lib/auth-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid sign-in request." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("email" in body) ||
    typeof body.email !== "string" ||
    !("password" in body) ||
    typeof body.password !== "string"
  ) {
    return Response.json({ error: "Email and password are required." }, { status: 400 });
  }

  let session: DemoSession | null;
  try {
    session = await login(body.email, body.password);
  } catch (cause) {
    console.error("Unable to create a Lumina sign-in session.", cause);
    if (
      cause instanceof Error &&
      (cause.message === "LUMINA_AUTH_SECRET must be configured in production." ||
        cause.message === "LUMINA_AUTH_SECRET must be at least 32 bytes.")
    ) {
      return Response.json(
        { error: "Sign-in is unavailable. Configure LUMINA_AUTH_SECRET on the server." },
        { status: 503, headers: { "Cache-Control": "private, no-store" } },
      );
    }
    return Response.json(
      { error: "Sign-in is temporarily unavailable. Please try again later." },
      { status: 500, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  if (!session) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return Response.json(
    { session },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
