import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const session = await getCurrentUser();
  return Response.json(
    { session },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
