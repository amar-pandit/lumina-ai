"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useDemoSession } from "@/components/auth/useDemoSession";
import {
  BarChart3,
  BadgeCheck,
  BookOpen,
  BookOpenCheck,
  Building2,
  CalendarDays,
  CalendarCheck2,
  ClipboardList,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  Mic,
  Menu,
  MessageSquare,
  NotebookPen,
  Settings,
  ShieldAlert,
  Sparkles,
  Siren,
  TableProperties,
  Trophy,
  UserRound,
  X,
} from "lucide-react";

const studentNav = [
  { label: "Overview", href: "/student/dashboard", icon: BarChart3 },
  { label: "Attendance", href: "/student/attendance", icon: ClipboardCheck },
  { label: "Academic Risk", href: "/student/risk", icon: ShieldAlert },
  { label: "Recovery Plan", href: "/student/recovery", icon: BookOpenCheck },
  { label: "Subjects & grades", href: "/student/academics/subjects", icon: GraduationCap },
  { label: "Study prescriptions", href: "/student/academics/prescriptions", icon: NotebookPen },
  { label: "Cohort benchmarks", href: "/student/benchmarks", icon: Trophy },
  { label: "Academic calendar", href: "/student/calendar", icon: CalendarDays },
];

const facultyNav = [
  { label: "Command center", href: "/faculty/dashboard", icon: LayoutDashboard },
  { label: "Voice attendance", href: "/faculty/voice-entry", icon: Mic },
  { label: "Attendance grid", href: "/faculty/courses/demo/attendance-grid", icon: CalendarCheck2 },
  { label: "Gradebook", href: "/faculty/courses/demo/gradebook", icon: FileSpreadsheet },
  { label: "Curriculum heatmap", href: "/faculty/courses/demo/heatmap", icon: TableProperties },
  { label: "Remedial groups", href: "/faculty/courses/demo/remedial", icon: BookOpen },
  { label: "Interventions", href: "/faculty/interventions", icon: ClipboardList },
];

const adminNav = [
  { label: "Institution overview", href: "/admin/dashboard", icon: LayoutDashboard },
  { label: "Departments", href: "/admin/departments/demo", icon: Building2 },
  { label: "Escalations", href: "/admin/escalations", icon: Siren },
  { label: "Accreditation", href: "/admin/accreditation", icon: BadgeCheck },
  { label: "Parent gateway", href: "/admin/parent-gateway", icon: MessageSquare },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const mentorNav = [
  { label: "Mentor dashboard", href: "/mentor/dashboard", icon: LayoutDashboard },
  ...facultyNav.filter((item) => item.href !== "/faculty/dashboard"),
];

const hodNav = [
  { label: "HOD dashboard", href: "/hod/dashboard", icon: LayoutDashboard },
  { label: "Attendance grid", href: "/faculty/courses/demo/attendance-grid", icon: CalendarCheck2 },
  { label: "Gradebook", href: "/faculty/courses/demo/gradebook", icon: FileSpreadsheet },
  { label: "Mentor dashboard", href: "/mentor/dashboard", icon: UserRound },
];

export function Sidebar() {
  const pathname = usePathname();
  const { session } = useDemoSession();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isAdmin = pathname.startsWith("/admin");
  const isHod = pathname.startsWith("/hod");
  const isMentor = pathname.startsWith("/mentor");
  const isFaculty = pathname.startsWith("/faculty");
  const roleNavItems = session?.role === "HOD"
    ? hodNav
    : isHod ? hodNav : isMentor ? mentorNav : isAdmin ? adminNav : isFaculty ? facultyNav : studentNav;
  const navItems = session?.role === "HOD" && isAdmin
    ? roleNavItems.filter((item) => item.href !== "/admin/settings")
    : roleNavItems;
  const workspaceName = isHod ? "Department workspace" : isMentor ? "Mentor workspace" : isAdmin ? "Institution workspace" : isFaculty ? "Faculty workspace" : "Student workspace";
  const profileLabel = session?.role ?? (isAdmin ? "Academic leadership" : isFaculty ? "Faculty demo profile" : "CSE • Semester 4");
  const profileInitials = session?.user.name.split(/\s+/).slice(0, 2).map((part) => part.charAt(0)).join("") ?? "AK";

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-white/10 bg-[#0b1314]/90 backdrop-blur-xl lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:border-b-0 lg:border-r lg:border-white/10">
      <div className="flex items-center justify-between p-4 lg:px-5 lg:pb-6 lg:pt-6">
        <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-offset-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-300/10 text-emerald-200 shadow-[0_0_26px_rgba(74,222,128,0.08)]">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-base font-semibold text-white">Lumina AI</p>
            <p className="mt-0.5 text-[10px] font-medium uppercase text-zinc-500">{workspaceName}</p>
          </div>
        </Link>

        <button
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={isMobileOpen}
          onClick={() => setIsMobileOpen((open) => !open)}
          className="rounded-xl border border-zinc-700 bg-zinc-900 p-2 text-zinc-200 transition hover:border-zinc-600 lg:hidden"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      <nav className={`${isMobileOpen ? "flex" : "hidden"} min-h-0 flex-1 flex-col px-4 pb-4 lg:flex lg:px-4`}>
        <div className="space-y-1.5">
          {navItems.map(({ label, href, icon: Icon }) => {
            const isActive = pathname === href;

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? "border border-emerald-200/15 bg-emerald-300/10 text-emerald-100 shadow-[inset_2px_0_0_0_rgba(139,224,189,0.8)]"
                    : "text-zinc-400 hover:bg-white/[0.04] hover:text-white"
                }`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.035] p-4 lg:mt-auto">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-300/20 to-cyan-300/10 text-sm font-semibold text-emerald-100">
              {profileInitials}
            </div>
            <div>
              <p className="font-medium text-white">{session?.user.name ?? "Amar Kumar"}</p>
              <p className="text-xs text-zinc-400">{profileLabel}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-zinc-300">
            <span className="inline-flex items-center gap-2">
              <UserRound className="h-3.5 w-3.5 text-cyan-400" />
              Demo profile
            </span>
            <span className="text-cyan-400">Active</span>
          </div>
        </div>
      </nav>
    </aside>
  );
}
