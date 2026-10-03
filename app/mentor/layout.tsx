import { Sidebar } from "@/components/layout/Sidebar";
import { dashboardForRole, getCurrentUser } from "@/lib/auth";
import { canAccessRoute } from "@/lib/auth-types";
import { redirect } from "next/navigation";

export default async function MentorLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentUser();
  if (!session) redirect("/auth");
  if (!canAccessRoute(session.role, "/mentor/dashboard")) redirect(dashboardForRole(session.role));

  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col lg:flex-row">
        <Sidebar />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
