"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronDown, Command, Search, UserRound, X } from "lucide-react";
import { useDemoSession } from "@/components/auth/useDemoSession";
import { clearLegacyDemoAuth, notifyDemoAuthChange } from "@/lib/demo-auth";
import { canAccessRoute, type AuthRole } from "@/lib/auth-types";
import { courses } from "@/lib/demo-data";
import { getEscalationCandidates } from "@/lib/admin-analytics";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getDemoRoster, type DemoNotification } from "@/lib/demo-model";
import { HOD_DEPARTMENT } from "@/lib/hod-data";
import { useDemoState } from "@/lib/use-demo-state";

interface DemoRoute {
  label: string;
  route: string;
}

interface DemoSearchResult {
  label: string;
  detail: string;
  route: string;
}

const demoRoutes: DemoRoute[] = [
  { label: "Student dashboard", route: "/student/dashboard" },
  { label: "Mentor dashboard", route: "/mentor/dashboard" },
  { label: "HOD dashboard", route: "/hod/dashboard" },
  { label: "Attendance simulator", route: "/student/attendance" },
  { label: "Academic risk", route: "/student/risk" },
  { label: "Recovery plan", route: "/student/recovery" },
  { label: "Subjects and grades", route: "/student/academics/subjects" },
  { label: "Study prescriptions", route: "/student/academics/prescriptions" },
  { label: "Cohort benchmarks", route: "/student/benchmarks" },
  { label: "Academic calendar", route: "/student/calendar" },
  { label: "Faculty command center", route: "/faculty/dashboard" },
  { label: "Voice attendance entry", route: "/faculty/voice-entry" },
  { label: "Attendance grid", route: "/faculty/courses/demo/attendance-grid" },
  { label: "Gradebook", route: "/faculty/courses/demo/gradebook" },
  { label: "Curriculum heatmap", route: "/faculty/courses/demo/heatmap" },
  { label: "Remedial groups", route: "/faculty/courses/demo/remedial" },
  { label: "Interventions", route: "/faculty/interventions" },
  { label: "Institution dashboard", route: "/admin/dashboard" },
  { label: "Departments", route: "/admin/departments/demo" },
  { label: "Escalations", route: "/admin/escalations" },
  { label: "Accreditation reports", route: "/admin/accreditation" },
  { label: "Parent gateway", route: "/admin/parent-gateway" },
  { label: "Demo settings", route: "/admin/settings" },
];

const roleLabels: Record<AuthRole, string> = {
  STUDENT: "Student",
  FACULTY: "Faculty",
  MENTOR: "Mentor",
  HOD: "HOD",
  ADMIN: "Admin",
};

export function DemoControls() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useDemoSession();
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const term = demoState.term;
  const notifications = useMemo<DemoNotification[]>(() => {
    const roster = getDemoRoster(demoState);
    const notificationRoster = session?.role === "STUDENT"
      ? roster.filter((student) => student.id === 1)
      : session?.role === "HOD"
        ? roster.filter((student) => student.department === HOD_DEPARTMENT)
        : roster;
    const roleHome = session?.role === "STUDENT"
      ? "/student/dashboard"
      : session?.role === "FACULTY"
        ? "/faculty/dashboard"
        : session?.role === "MENTOR"
          ? "/mentor/dashboard"
          : session?.role === "HOD"
            ? "/hod/dashboard"
            : "/admin/dashboard";
    const routeFor = (studentRoute: string, facultyRoute: string, adminRoute: string) => (
      session?.role === "STUDENT" ? studentRoute
        : session?.role === "FACULTY" ? facultyRoute
          : session?.role === "MENTOR" ? facultyRoute
            : session?.role === "HOD" ? "/hod/dashboard"
              : adminRoute
    );
    const generated: DemoNotification[] = [
      ...notificationRoster.filter((student) => student.status === "Critical").slice(0, 4).map((student) => ({
        id: `critical-risk-${student.id}`,
        message: `Critical risk detected for ${student.name}.`,
        route: routeFor("/student/risk", "/faculty/dashboard", "/admin/escalations"),
        read: false,
      })),
      ...notificationRoster.filter((student) => student.attendance < demoState.settings.attendanceMinimum).slice(0, 3).map((student) => ({
        id: `low-attendance-${student.id}`,
        message: `Attendance is below threshold for ${student.name}.`,
        route: routeFor("/student/attendance", "/faculty/courses/demo/attendance-grid", "/admin/dashboard"),
        read: false,
      })),
      ...(demoState.completedRecoveryTaskIds.length > 0 ? [{
        id: "recovery-plan-updated",
        message: "Recovery plan progress has been updated.",
        route: routeFor("/student/recovery", "/faculty/interventions", roleHome),
        read: false,
      }] : []),
      ...demoState.interventions
        .filter((item) => item.id > 4 && item.status !== "Cancelled")
        .filter((item) => session?.role !== "HOD" || notificationRoster.some((student) => student.name === item.student))
        .slice(0, 3)
        .map((item) => ({
        id: `intervention-${item.id}`,
        message: `Intervention ${item.status.toLowerCase()} for ${item.student}.`,
        route: routeFor("/student/recovery", "/faculty/interventions", roleHome),
        read: false,
      })),
      ...(session?.role === "STUDENT" ? [] : getEscalationCandidates(notificationRoster, demoState))
        .filter((item) => item.status !== "Closed" && Boolean(demoState.escalationRecords[item.student.id]))
        .slice(0, 3)
        .map((item) => ({
          id: `escalation-${item.student.id}`,
          message: `Escalation ${item.status.toLowerCase()} for ${item.student.name}.`,
          route: routeFor("/student/risk", "/faculty/dashboard", "/admin/escalations"),
          read: false,
        })),
      ...notificationRoster.filter((student) => demoState.parentContactRecords[student.id]?.status === "Sent").slice(0, 3).map((student) => ({
        id: `parent-notification-${student.id}`,
        message: `Demo parent notification marked sent for ${student.name}.`,
        route: routeFor("/student/dashboard", "/faculty/dashboard", "/admin/parent-gateway"),
        read: false,
      })),
    ].slice(0, 12);
    const dismissed = new Set(demoState.dismissedNotificationIds ?? []);
    return generated.filter((item) => !dismissed.has(item.id)).map((item) => ({
      ...item,
      read: demoState.notifications.find((stored) => stored.id === item.id)?.read ?? false,
    }));
  }, [demoState, session?.role]);
  const dataSearchResults = useMemo<DemoSearchResult[]>(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return [];
    const roster = getDemoRoster(demoState);
    const isStudent = session?.role === "STUDENT";
    const isFaculty = session?.role === "FACULTY" || session?.role === "MENTOR";
    const isHod = session?.role === "HOD";
    const isAdmin = session?.role === "ADMIN";
    const scopedRoster = isHod ? roster.filter((student) => student.department === HOD_DEPARTMENT) : roster;
    const studentResults = scopedRoster
      .filter((student) => !isStudent || student.id === 1)
      .filter((student) => `${student.name} ${student.rollNo} ${student.department} ${student.course}`.toLowerCase().includes(query))
      .map((student) => ({
        label: student.name,
        detail: `${student.rollNo} · ${student.department} · ${student.status} risk`,
        route: isStudent ? "/student/risk" : isFaculty ? "/faculty/dashboard" : isHod ? "/hod/dashboard" : "/admin/dashboard",
      }));
    const allowedHodCourses = new Set(scopedRoster.map((student) => student.course));
    const courseResults = courses
      .filter((course) => !isHod || allowedHodCourses.has(course.name))
      .filter((course) => course.name.toLowerCase().includes(query))
      .map((course) => {
        const score = (isHod ? scopedRoster : roster).find((student) => student.id === 1)?.subjectMarks[course.name] ?? course.score;
        return {
          label: course.name,
          detail: `Course / subject · ${score}% mastery`,
          route: isStudent ? "/student/academics/subjects" : isFaculty ? "/faculty/courses/demo/gradebook" : isHod ? "/hod/dashboard" : "/admin/departments/demo",
        };
      });
    const interventionResults = !isStudent
      ? demoState.interventions
        .filter((item) => !isHod || scopedRoster.some((student) => student.name === item.student))
        .filter((item) => `${item.student} ${item.mentor} ${item.type} ${item.status} ${item.notes}`.toLowerCase().includes(query))
        .map((item) => ({
          label: `${item.type} · ${item.student}`,
          detail: `${item.status} · ${item.date}`,
          route: isFaculty ? "/faculty/interventions" : isHod ? "/hod/dashboard" : "/admin/dashboard",
        }))
      : [];
    const escalationResults = isAdmin
      ? getEscalationCandidates(roster, demoState)
        .filter((item) => `${item.student.name} ${item.student.rollNo} ${item.criticalSubjects.join(" ")}`.toLowerCase().includes(query))
        .map((item) => ({
          label: `Escalation · ${item.student.name}`,
          detail: `${item.status} · ${item.criticalSubjects.length} critical subjects`,
          route: "/admin/escalations",
        }))
      : [];
    return [...studentResults, ...courseResults, ...interventionResults, ...escalationResults].slice(0, 12);
  }, [demoState, searchText, session?.role]);

  useEffect(() => {
    const openPalette = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", openPalette);
    return () => window.removeEventListener("keydown", openPalette);
  }, []);

  const unreadCount = notifications.filter((notification) => !notification.read).length;
  const roleRoutesAllowed = (route: string) => {
    if (!session) return true;
    return canAccessRoute(session.role, route);
  };
  const visibleRoutes = demoRoutes.filter((item) => (
    roleRoutesAllowed(item.route) && item.label.toLowerCase().includes(searchText.trim().toLowerCase())
  ));

  const logout = async () => {
    setAuthError(null);
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`Logout failed with status ${response.status}.`);
      clearLegacyDemoAuth();
      notifyDemoAuthChange();
      setProfileOpen(false);
      router.replace("/auth");
    } catch (cause) {
      console.error("Unable to clear the Lumina demo session.", cause);
      setAuthError("Unable to log out securely. Please retry.");
    }
  };

  const updateTerm = (nextTerm: string) => {
    setDemoState((previous) => ({ ...previous, term: nextTerm, settings: { ...previous.settings, academicTerm: nextTerm } }));
  };

  const markAllRead = () => setDemoState((previous) => ({ ...previous, notifications: notifications.map((item) => ({ ...item, read: true })) }));
  const markRead = (id: string) => setDemoState((previous) => ({
    ...previous,
    notifications: notifications.map((item) => item.id === id ? { ...item, read: true } : item),
  }));
  const clearNotifications = () => setDemoState((previous) => ({
    ...previous,
    dismissedNotificationIds: [...new Set([...(previous.dismissedNotificationIds ?? []), ...notifications.map((item) => item.id)])],
  }));

  return (
    <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
      <span title="Data, notifications, and integrations are simulated; no real messages are sent." aria-label="Lumina AI demo mode. Data, notifications, and integrations are simulated; no real messages are sent." className="inline-flex rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-2 py-1 text-[8px] font-semibold uppercase text-emerald-100 sm:px-2.5 sm:text-[9px]">LUMINA AI • DEMO MODE</span>
      <label className="sr-only" htmlFor="academic-term">Academic term</label>
      <select
        id="academic-term"
        value={term}
        onChange={(event) => updateTerm(event.target.value)}
        className="hidden h-10 max-w-32 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs text-zinc-300 outline-none transition hover:border-white/20 focus-visible:border-emerald-200/40 sm:block"
      >
        <option>Fall 2026</option>
        <option>Spring 2026</option>
        <option>Fall 2025</option>
      </select>

      {session ? (
        <>
          <label className="sr-only" htmlFor="demo-role">Authenticated role</label>
          <select
            id="demo-role"
            value={session.role}
            disabled
            className="h-10 max-w-32 rounded-xl border border-white/10 bg-white/[0.035] px-2 text-xs text-zinc-300 outline-none disabled:cursor-not-allowed disabled:opacity-90"
          >
            <option value={session.role}>{roleLabels[session.role]} ✓</option>
          </select>
        </>
      ) : (
        <Link href="/auth" className="inline-flex h-10 items-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-medium text-zinc-300 transition hover:border-emerald-200/30 hover:text-white">Log in</Link>
      )}
      {authError ? <span role="alert" className="text-xs text-rose-200">{authError}</span> : null}

      <button
        type="button"
        onClick={() => setSearchOpen(true)}
        aria-label="Open search and command palette"
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 transition hover:border-emerald-200/30 hover:text-white"
      >
        <Search className="h-4 w-4" />
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setNotificationOpen((open) => !open)}
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          aria-expanded={notificationOpen}
          className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-zinc-300 transition hover:border-emerald-200/30 hover:text-white"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-rose-300" /> : null}
        </button>
        {notificationOpen ? (
          <section aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-white/10 bg-[#111a1b] p-3 shadow-2xl shadow-black/50">
            <div className="flex items-center justify-between border-b border-white/10 px-1 pb-3">
              <div><h2 className="text-sm font-semibold text-white">Notifications</h2><p className="mt-0.5 text-xs text-zinc-500">{unreadCount} unread · demo feed</p></div>
              <button type="button" onClick={markAllRead} className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white"><CheckCheck className="h-3.5 w-3.5" />Mark all read</button>
            </div>
            <ul className="mt-2 space-y-1" aria-live="polite">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link href={notification.route} onClick={() => markRead(notification.id)} className="flex items-start gap-2 rounded-xl p-2.5 text-xs text-zinc-300 transition hover:bg-white/[0.05]">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notification.read ? "bg-zinc-600" : "bg-emerald-300"}`} />
                    <span>{notification.message}<span className="mt-1 block text-[10px] text-zinc-500">Demo notification · Today</span></span>
                  </Link>
                </li>
              ))}
              {notifications.length === 0 ? <li className="px-3 py-6 text-center text-xs text-zinc-500">No notifications.</li> : null}
            </ul>
            {notifications.length > 0 ? <button type="button" onClick={clearNotifications} className="mt-2 w-full rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-400 transition hover:text-white">Clear demo notifications</button> : null}
          </section>
        ) : null}
      </div>

      <div className="relative">
        {session ? (
          <>
            <button
              type="button"
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Open profile menu"
              aria-expanded={profileOpen}
              className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-2.5 text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <UserRound className="h-4 w-4" /><span className="hidden max-w-24 truncate text-xs sm:inline">{session.user.name}</span><ChevronDown className="h-3 w-3" />
            </button>
            {profileOpen ? (
              <div className="absolute right-0 top-12 z-50 w-56 rounded-2xl border border-white/10 bg-[#111a1b] p-2 shadow-2xl shadow-black/50">
                <div className="border-b border-white/10 px-3 py-2">
                  <p className="text-sm font-medium text-white">{session.user.name}</p>
                  <p className="mt-0.5 text-xs text-zinc-400">{session.user.role}</p>
                  <p className="mt-2 text-[10px] font-medium uppercase tracking-wide text-emerald-200">Demo Mode</p>
                </div>
                {session.role === "ADMIN" ? (
                  <Link href="/admin/settings" onClick={() => setProfileOpen(false)} className="mt-1 block rounded-lg px-3 py-2 text-sm text-zinc-200 hover:bg-white/[0.05]">Demo settings</Link>
                ) : null}
                <Link href="/" onClick={() => setProfileOpen(false)} className="block rounded-lg px-3 py-2 text-sm text-zinc-400 hover:bg-white/[0.05]">Return to home</Link>
                <button type="button" onClick={logout} className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-200 transition hover:bg-rose-300/[0.08]">Logout</button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {searchOpen ? (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-black/70 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSearchOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="Search Lumina AI" className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#111a1b] shadow-2xl shadow-black/60">
            <div className="flex items-center gap-3 border-b border-white/10 px-4">
              <Command className="h-4 w-4 text-emerald-200" />
              <input autoFocus value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search students, courses, interventions..." className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" />
              <button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search" className="rounded-lg p-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white"><X className="h-4 w-4" /></button>
            </div>
            <ul className="max-h-[55vh] overflow-y-auto p-2">
              {searchText.trim() ? (
                <>
                  {dataSearchResults.map((item, index) => (
                    <li key={`${item.route}-${item.label}-${index}`}><Link href={item.route} onClick={() => { setSearchOpen(false); setSearchText(""); }} className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm text-zinc-300 transition hover:bg-white/[0.05] hover:text-white"><span>{item.label}<span className="mt-0.5 block text-xs text-zinc-500">{item.detail}</span></span><span className="shrink-0 text-[10px] text-zinc-600">{item.route}</span></Link></li>
                  ))}
                  {visibleRoutes.map((item) => (
                    <li key={item.route}><Link href={item.route} onClick={() => { setSearchOpen(false); setSearchText(""); }} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${pathname === item.route ? "bg-emerald-200/10 text-emerald-100" : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"}`}><span>{item.label}</span><span className="text-[10px] text-zinc-600">{item.route}</span></Link></li>
                  ))}
                  {visibleRoutes.length === 0 && dataSearchResults.length === 0 ? <li className="px-3 py-6 text-center text-sm text-zinc-500">No matching records found.</li> : null}
                </>
              ) : visibleRoutes.map((item) => (
                <li key={item.route}><Link href={item.route} onClick={() => { setSearchOpen(false); setSearchText(""); }} className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition ${pathname === item.route ? "bg-emerald-200/10 text-emerald-100" : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"}`}><span>{item.label}</span><span className="text-[10px] text-zinc-600">{item.route}</span></Link></li>
              ))}
            </ul>
            <p className="border-t border-white/10 px-4 py-2 text-[10px] text-zinc-500">Press Esc to close · Ctrl K to search</p>
          </section>
        </div>
      ) : null}
    </div>
  );
}
