import { getCurrentUser } from "@/lib/auth";
import { isFaceDescriptorSet } from "@/lib/face-auth/match";
import { registerFaceIdentity } from "@/lib/face-auth/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getCurrentUser();
  if (!session) {
    return Response.json({ error: "Sign in with Email & Password before registering Face ID." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid face registration request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("descriptors" in body) || !isFaceDescriptorSet(body.descriptors)) {
    return Response.json({ error: "Three valid face samples are required to register Face ID." }, { status: 400 });
  }

  try {
    registerFaceIdentity(session.user.id, body.descriptors);
  } catch (cause) {
    if (cause instanceof Error && cause.message === "FACE_ALREADY_REGISTERED") {
      return Response.json({ error: "Face ID is already registered for this account." }, { status: 409 });
    }
    if (cause instanceof Error && cause.message === "FACE_ALREADY_ASSIGNED") {
      return Response.json({ error: "This face is already registered to a different Lumina account." }, { status: 409 });
    }
    console.error("Unable to store the encrypted Face ID identity.", cause);
    return Response.json({ error: "Face ID registration could not be saved. Please try again." }, { status: 500 });
  }

  return Response.json(
    { registered: true },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
