import { loginWithFaceIdentity } from "@/lib/auth";
import { findFaceMatch, isFaceDescriptorSet } from "@/lib/face-auth/match";
import { listFaceIdentities } from "@/lib/face-auth/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid Face ID verification request." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("descriptors" in body) || !isFaceDescriptorSet(body.descriptors)) {
    return Response.json({ error: "Three valid face samples are required for Face ID login." }, { status: 400 });
  }

  const userId = findFaceMatch(body.descriptors, listFaceIdentities());
  if (!userId) {
    return Response.json(
      { error: "Face not recognized. Try again or use Email & Password." },
      { status: 401, headers: { "Cache-Control": "private, no-store" } },
    );
  }

  try {
    const session = await loginWithFaceIdentity(userId);
    return Response.json(
      { session },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (cause) {
    console.error("Verified Face ID does not map to a valid Lumina account.", cause);
    return Response.json({ error: "The matched Face ID account is unavailable." }, { status: 401 });
  }
}
