import { logout } from "@/lib/auth";

export async function POST() {
  await logout();
  return new Response(null, {
    status: 204,
    headers: { "Cache-Control": "private, no-store" },
  });
}
