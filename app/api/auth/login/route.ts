import { login } from "@/lib/auth";

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

  const session = await login(body.email, body.password);
  if (!session) {
    return Response.json({ error: "Invalid email or password." }, { status: 401 });
  }

  return Response.json(
    { session },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
