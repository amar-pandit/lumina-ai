"use client";

import Link from "next/link";
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Check, Download, FileCheck2, Search, X } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { courses, type FacultyStudent } from "@/lib/demo-data";
import { calculateAttainment } from "@/lib/accreditation-engine";
import {
  getDepartmentCourseAnalytics,
  getEscalationCandidates,
  parentCommunicationTrigger,
  riskCategoryLabel,
  type DepartmentCourseAnalytics,
  type EscalationCandidate,
} from "@/lib/admin-analytics";
import {
  DEMO_SETTINGS,
  DEMO_STATE_KEY,
  INITIAL_DEMO_STATE,
  normalizeDemoSettings,
  getDemoRoster,
  type DemoEscalationStatus,
  type DemoState,
  type DemoSettings,
} from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";
import { ReportExportButton } from "@/components/reports/ReportExportButton";
import type { ReportDocument } from "@/lib/reports/types";
import { DEMO_USER_IDS } from "@/lib/auth-types";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5";
const statuses: DemoEscalationStatus[] = ["New", "In Review", "Actioned", "Closed"];
const standards = ["NAAC", "NBA", "ABET"] as const;
type AccreditationStandard = (typeof standards)[number];
type AccreditationAssessment = "Overall" | "CIA" | "Midterm" | "Lab" | "Assignment";

function AdminHeader({ title, subtitle, report }: { title: string; subtitle: string; report?: ReportDocument }) {
  return <div className="print:hidden"><Topbar title={title} subtitle={subtitle} workspace="Institution" action={report ? <ReportExportButton report={report} /> : null} /></div>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

function Badge({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const tones = {
    neutral: "border-white/10 bg-white/[0.04] text-zinc-300",
    good: "border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100",
    warn: "border-amber-200/20 bg-amber-200/[0.07] text-amber-100",
    bad: "border-rose-200/20 bg-rose-200/[0.07] text-rose-100",
  };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}

function useToast() {
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const timeout = useRef<number | null>(null);
  const notify = useCallback((nextMessage: string, error = false) => {
    setMessage(nextMessage);
    setIsError(error);
    if (timeout.current !== null) window.clearTimeout(timeout.current);
    timeout.current = window.setTimeout(() => setMessage(""), 2600);
  }, []);
  useEffect(() => () => {
    if (timeout.current !== null) window.clearTimeout(timeout.current);
  }, []);
  const Toast = () => message ? (
    <div role={isError ? "alert" : "status"} aria-live={isError ? "assertive" : "polite"} className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl ${isError ? "border-rose-200/20 bg-[#241111] text-rose-100" : "border-emerald-200/20 bg-[#102019] text-emerald-100"}`}>
      {isError ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}{message}
    </div>
  ) : null;
  return { notify, Toast };
}

function currentDateTime() {
  return new Date().toISOString();
}

function recoveryStatus(student: FacultyStudent, state: DemoState) {
  if (state.completedRecoveryTaskIds.length > 0 && student.id === 1) return "Recovering";
  const related = state.interventions.filter((item) => item.student === student.name);
  if (related.some((item) => item.status === "Completed")) return "Recovering";
  if (related.some((item) => item.status === "Scheduled")) return "Intervention active";
  return "Not started";
}

export function AdminDashboard() {
  const [state] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const roster = useMemo(() => getDepartmentCourseAnalytics(
    // A fresh roster is generated from persisted faculty attendance and marks.
    getAdminRoster(state),
    state,
  ), [state]);
  const students = useMemo(() => getAdminRoster(state), [state]);
  const escalations = getEscalationCandidates(students, state);
  const riskCounts = {
    safe: students.filter((student) => student.status === "Safe").length,
    moderate: students.filter((student) => student.status === "Moderate").length,
    critical: students.filter((student) => student.status === "Critical").length,
    recovering: students.filter((student) => recoveryStatus(student, state) === "Recovering").length,
  };
  const averageAttendance = students.length === 0
    ? 0
    : students.reduce((total, student) => total + student.attendance, 0) / students.length;
  const activeInterventions = state.interventions.filter((item) => item.status === "Scheduled").length;
  const recoveringStudents = new Set(state.interventions.filter((item) => item.status === "Completed").map((item) => item.student)).size
    + (state.completedRecoveryTaskIds.length > 0 && !state.interventions.some((item) => item.student === "Amar Kumar" && item.status === "Completed") ? 1 : 0);
  const activeEscalations = escalations.filter((item) => item.status !== "Closed");
  const recentInterventions = [...state.interventions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  const courseOverview = roster.slice(0, 12);
  const completedInterventionStudents = new Set(state.interventions
    .filter((item) => item.status === "Completed")
    .map((item) => item.student));
  const departmentOverview = [...new Set(students.map((student) => student.department))].map((department) => {
    const cohort = students.filter((student) => student.department === department);
    return [
      department,
      cohort.length,
      `${(cohort.reduce((total, student) => total + student.attendance, 0) / Math.max(cohort.length, 1)).toFixed(1)}%`,
      `${(cohort.reduce((total, student) => total + student.assessmentAverage, 0) / Math.max(cohort.length, 1)).toFixed(1)}%`,
      cohort.filter((student) => student.status !== "Safe").length,
      cohort.filter((student) => student.status === "Critical").length,
      `${cohort.length ? Math.round(cohort.filter((student) => completedInterventionStudents.has(student.name)).length / cohort.length * 100) : 0}%`,
    ] as Array<string | number>;
  });

  return (
    <div>
      <AdminHeader title={normalizeDemoSettings(state.settings).institutionName || "Institution Command Center"} subtitle="Live institutional risk, attendance, intervention, and course health." report={{
        type: "admin-institution-summary",
        title: "Institution Academic Intelligence Report",
        period: state.term,
        reportSheetName: "Department Overview",
        summarySheetName: "Institution Summary",
        columns: ["Department", "Students", "Attendance %", "Academic Performance %", "At Risk", "Critical", "Recovery Progress %"],
        rows: departmentOverview,
        summary: [["Total Students", students.length], ["Total Faculty Accounts", Object.keys(DEMO_USER_IDS).filter((role) => role === "FACULTY").length], ["Total Mentor Accounts", Object.keys(DEMO_USER_IDS).filter((role) => role === "MENTOR").length], ["Departments", new Set(students.map((student) => student.department)).size], ["Average Attendance", `${averageAttendance.toFixed(1)}%`], ["At-Risk Students", riskCounts.moderate + riskCounts.critical], ["Critical Students", riskCounts.critical], ["Active Interventions", activeInterventions]],
        workbookSheets: [
          {
            name: "Course Overview",
            columns: ["Department", "Course", "Students", "Attendance %", "Academic Performance %", "At Risk", "Critical", "Recovery Progress %"],
            rows: roster.map((item) => [item.department, item.course, item.totalStudents, `${item.averageAttendance}%`, `${item.averageAssessment}%`, item.atRiskStudents, item.criticalStudents, `${item.recoveryProgress}%`]),
          },
          {
            name: "Risk Distribution",
            columns: ["Risk Level", "Students", "Percentage"],
            rows: [
              ["CRITICAL", riskCounts.critical, `${students.length ? (riskCounts.critical / students.length * 100).toFixed(1) : "0.0"}%`],
              ["MODERATE", riskCounts.moderate, `${students.length ? (riskCounts.moderate / students.length * 100).toFixed(1) : "0.0"}%`],
              ["SAFE", riskCounts.safe, `${students.length ? (riskCounts.safe / students.length * 100).toFixed(1) : "0.0"}%`],
              ["RECOVERING", riskCounts.recovering, `${students.length ? (riskCounts.recovering / students.length * 100).toFixed(1) : "0.0"}%`],
            ],
          },
          {
            name: "Student Risk Data",
            columns: ["Student", "Department", "Course", "Attendance %", "Academic Performance %", "Risk Score", "Risk Level", "Risk Factors"],
            rows: students.map((student) => [student.name, student.department, student.course, `${student.attendance}%`, `${student.assessmentAverage}%`, student.risk, student.status, student.riskDrivers.join(", ")]),
          },
        ],
      }} />
      <main className="space-y-5 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <ReportExportButton report={{
            type: "admin-attendance",
            title: "Admin Institution Attendance Report",
            period: state.term,
            columns: ["Department", "Students", "Average Attendance", "Below Threshold", "Critical Attendance Cases"],
            rows: [...new Set(students.map((student) => student.department))].map((department) => {
              const cohort = students.filter((student) => student.department === department);
              return [department, cohort.length, `${(cohort.reduce((sum, student) => sum + student.attendance, 0) / Math.max(cohort.length, 1)).toFixed(1)}%`, cohort.filter((student) => student.attendance < state.settings.attendanceMinimum).length, cohort.filter((student) => student.attendance < state.settings.attendanceMinimum && student.status === "Critical").length];
            }),
            summary: [["Total Students", students.length], ["Average Attendance", `${averageAttendance.toFixed(1)}%`]],
          }} />
          <ReportExportButton report={{
            type: "admin-risk",
            title: "Admin Institution Risk Report",
            period: state.term,
            columns: ["Student", "Department", "Course", "Attendance", "Academic Score", "Risk Score", "Risk Level", "Risk Factors"],
            rows: students.map((student) => [student.name, student.department, student.course, `${student.attendance}%`, `${student.assessmentAverage}%`, student.risk.toFixed(1), student.status, student.riskDrivers.join(", ")]),
            summary: [["At-Risk Students", riskCounts.moderate + riskCounts.critical], ["Critical Students", riskCounts.critical]],
          }} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Total students" value={String(students.length)} />
          <Metric label="Students at risk" value={String(riskCounts.moderate + riskCounts.critical)} />
          <Metric label="Critical students" value={String(riskCounts.critical)} />
          <Metric label="Average attendance" value={`${averageAttendance.toFixed(1)}%`} />
          <Metric label="Students recovering" value={String(recoveringStudents)} />
          <Metric label="Active interventions" value={String(activeInterventions)} />
          <Metric label="Escalations" value={String(activeEscalations.length)} detail={`${activeEscalations.filter((item) => item.status === "New").length} new`} />
          <Metric label="Safe students" value={String(riskCounts.safe)} />
        </div>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className={panel}>
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="font-semibold text-white">Risk distribution</h2><p className="mt-1 text-xs text-zinc-500">Calculated from the shared academic risk engine.</p></div>
              <Link href="/admin/escalations" className="text-xs text-emerald-200 hover:text-white">Escalations <ArrowRight className="inline h-3.5 w-3.5" /></Link>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="Safe" value={String(riskCounts.safe)} />
              <Metric label="Moderate" value={String(riskCounts.moderate)} />
              <Metric label="Critical" value={String(riskCounts.critical)} />
              <Metric label="Recovering" value={String(riskCounts.recovering)} />
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10" role="img" aria-label={`Risk distribution: ${riskCounts.safe} safe, ${riskCounts.moderate} moderate, ${riskCounts.critical} critical`}>
              {[
                { count: riskCounts.safe, color: "bg-emerald-300" },
                { count: riskCounts.moderate, color: "bg-amber-300" },
                { count: riskCounts.critical, color: "bg-rose-300" },
              ].map((part) => <span key={part.color} className={part.color} style={{ width: `${students.length ? part.count / students.length * 100 : 0}%` }} />)}
            </div>
          </section>

          <section className={panel}>
            <div className="mb-4 flex items-center justify-between">
              <div><h2 className="font-semibold text-white">Department / course overview</h2><p className="mt-1 text-xs text-zinc-500">Attendance and assessment averages use current demo records.</p></div>
              <Link href="/admin/departments/demo" className="text-xs text-emerald-200 hover:text-white">Explore departments <ArrowRight className="inline h-3.5 w-3.5" /></Link>
            </div>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {courseOverview.map((item) => (
                <div key={`${item.department}-${item.course}`} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-white">{item.department} · {item.course}</p>
                    <Badge tone={item.criticalStudents > 0 ? "bad" : item.atRiskStudents > 0 ? "warn" : "good"}>{item.criticalStudents} critical</Badge>
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">{item.totalStudents} students · {item.averageAttendance}% attendance · {item.averageAssessment}% average assessment</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className={panel}>
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Students requiring attention</h2><p className="mt-1 text-xs text-zinc-500">Highest risk students from the live roster.</p></div><Link href="/admin/departments/demo" className="text-xs text-emerald-200">View cohort</Link></div>
            <div className="overflow-x-auto"><table className="min-w-[600px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Student</th><th className="py-3">Risk</th><th className="py-3">Attendance</th><th className="py-3">Department</th></tr></thead><tbody>{students.filter((student) => student.status !== "Safe").sort((a, b) => b.risk - a.risk).slice(0, 8).map((student) => <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3"><span className="font-medium text-white">{student.name}</span><span className="ml-2 text-zinc-500">{student.rollNo}</span></td><td className="py-3">{student.risk.toFixed(1)} · {student.status}</td><td className="py-3">{student.attendance}%</td><td className="py-3">{student.department}</td></tr>)}</tbody></table></div>
          </section>
          <section className={panel}>
            <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Recent interventions</h2><p className="mt-1 text-xs text-zinc-500">Latest records from the shared intervention state.</p></div><Link href="/admin/escalations" className="text-xs text-emerald-200">Escalation summary</Link></div>
            {recentInterventions.length ? <ul className="space-y-2">{recentInterventions.map((item) => <li key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><div><p className="text-sm font-medium text-white">{item.student} · {item.type}</p><p className="mt-1 text-xs text-zinc-500">{item.date} · {item.mentor}</p></div><Badge tone={item.status === "Completed" ? "good" : item.status === "No-show" ? "bad" : "warn"}>{item.status}</Badge></li>)}</ul> : <p className="py-8 text-center text-sm text-zinc-500">No interventions have been recorded.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}

function getAdminRoster(state: DemoState): FacultyStudent[] {
  return getDemoRoster(state);
}

export function AdminDepartments() {
  const [state] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const analytics = getDepartmentCourseAnalytics(getAdminRoster(state), state);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All");
  const [course, setCourse] = useState("All");
  const [risk, setRisk] = useState("All");
  const [selectedCourse, setSelectedCourse] = useState<DepartmentCourseAnalytics | null>(null);
  const departments = [...new Set(analytics.map((item) => item.department))];
  const filtered = analytics.filter((item) => (
    (department === "All" || item.department === department)
    && (course === "All" || item.course === course)
    && `${item.department} ${item.course}`.toLowerCase().includes(query.toLowerCase())
    && (risk === "All"
      || (risk === "Critical" && item.criticalStudents > 0)
      || (risk === "At risk" && item.atRiskStudents > 0)
      || (risk === "Safe" && item.atRiskStudents === 0))
  ));
  const activeDetail = selectedCourse
    ? analytics.find((item) => item.department === selectedCourse.department && item.course === selectedCourse.course) ?? selectedCourse
    : null;

  return (
    <div>
      <AdminHeader title="Department & Course Analytics" subtitle="Compare current department and course outcomes using shared student and risk data." report={{
        type: "admin-department-comparison",
        title: "Admin Department Comparison",
        period: state.term,
        filters: { Department: department, Course: course, Risk: risk, Search: query || "All" },
        columns: ["Department", "Course", "Student Count", "Attendance", "Academic Performance", "At Risk", "Critical", "Recovery Progress"],
        rows: filtered.map((item) => [item.department, item.course, item.totalStudents, `${item.averageAttendance}%`, `${item.averageAssessment}%`, item.atRiskStudents, item.criticalStudents, `${item.recoveryProgress}%`]),
      }} />
      <main className="space-y-5 p-4 sm:p-6">
        <section className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Department/course performance</h2><p className="mt-1 text-xs text-zinc-500">Select a course row to inspect its students.</p></div></div>
          <div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" /><input aria-label="Search departments and courses" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search department/course" className="w-full rounded-lg border border-white/10 bg-[#0b1213] py-2.5 pl-9 pr-3 text-xs text-white" /></label>
            <select aria-label="Filter department" value={department} onChange={(event) => setDepartment(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-300"><option>All</option>{departments.map((item) => <option key={item}>{item}</option>)}</select>
            <select aria-label="Filter course" value={course} onChange={(event) => setCourse(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-300"><option>All</option>{courses.map((item) => <option key={item.name}>{item.name}</option>)}</select>
            <select aria-label="Filter course risk" value={risk} onChange={(event) => setRisk(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-300"><option>All</option><option>Critical</option><option>At risk</option><option>Safe</option></select>
          </div>
          <div className="overflow-x-auto"><table className="min-w-[1000px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Department</th><th className="py-3">Course</th><th className="py-3">Total students</th><th className="py-3">Avg attendance</th><th className="py-3">Avg assessment</th><th className="py-3">At-risk</th><th className="py-3">Critical</th><th className="py-3">Recovery progress</th></tr></thead><tbody>{filtered.map((item) => <tr key={`${item.department}-${item.course}`} className="cursor-pointer border-b border-white/[0.06] text-zinc-300 hover:bg-white/[0.03]" onClick={() => setSelectedCourse(item)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedCourse(item); }} tabIndex={0}><td className="py-3">{item.department}</td><td className="py-3 font-medium text-white">{item.course}</td><td className="py-3">{item.totalStudents}</td><td className="py-3">{item.averageAttendance}%</td><td className="py-3">{item.averageAssessment}%</td><td className="py-3">{item.atRiskStudents}</td><td className="py-3">{item.criticalStudents}</td><td className="py-3">{item.recoveryProgress}%</td></tr>)}</tbody></table>{filtered.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No department/course records match those filters.</p> : null}</div>
        </section>
        {activeDetail ? <section className={panel}><div className="mb-4 flex items-start justify-between gap-3"><div><p className="text-xs text-zinc-500">{activeDetail.department}</p><h2 className="mt-1 text-lg font-semibold text-white">{activeDetail.course} · Student attainment</h2></div><button type="button" aria-label="Close course details" onClick={() => setSelectedCourse(null)} className="rounded-lg border border-white/10 p-2 text-zinc-300"><X className="h-4 w-4" /></button></div><div className="overflow-x-auto"><table className="min-w-[740px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Student</th><th className="py-3">Attendance</th><th className="py-3">Assessment</th><th className="py-3">Risk</th><th className="py-3">Category</th><th className="py-3">Recovery status</th></tr></thead><tbody>{activeDetail.students.map(({ student, assessment, risk: riskResult }) => <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3"><span className="font-medium text-white">{student.name}</span><span className="ml-2 text-zinc-500">{student.rollNo}</span></td><td className="py-3">{student.attendance}%</td><td className="py-3">{assessment}%</td><td className="py-3">{riskResult.score.toFixed(1)}</td><td className="py-3"><Badge tone={riskResult.category === "CRITICAL" ? "bad" : riskResult.category === "MODERATE" ? "warn" : "good"}>{riskCategoryLabel(riskResult.category)}</Badge></td><td className="py-3">{recoveryStatus(student, state)}</td></tr>)}</tbody></table></div></section> : null}
      </main>
    </div>
  );
}

export function AdminEscalations() {
  const [state, setState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const students = getAdminRoster(state);
  const candidates = getEscalationCandidates(students, state);
  const [selected, setSelected] = useState<EscalationCandidate | null>(null);
  const [filter, setFilter] = useState("All");
  const { notify, Toast } = useToast();

  useEffect(() => {
    const missing = candidates.filter((candidate) => !state.escalationRecords?.[candidate.student.id]);
    if (missing.length === 0) return;
    const createdAt = currentDateTime();
    setState((previous) => {
      const escalationRecords = { ...previous.escalationRecords };
      for (const item of missing) {
        escalationRecords[item.student.id] = { status: "New", createdAt, updatedAt: createdAt };
      }
      return { ...previous, escalationRecords };
    });
  }, [candidates, setState, state.escalationRecords]);

  const changeStatus = (candidate: EscalationCandidate, status: DemoEscalationStatus, createIntervention: boolean) => {
    const updatedAt = currentDateTime();
    setState((previous) => {
      const existing = previous.escalationRecords?.[candidate.student.id];
      const escalationRecords = {
        ...previous.escalationRecords,
        [candidate.student.id]: {
          status,
          createdAt: existing?.createdAt ?? updatedAt,
          updatedAt,
        },
      };
      let interventions = previous.interventions;
      if (createIntervention && !interventions.some((item) => item.student === candidate.student.name && item.type === "Institutional intervention" && item.status === "Scheduled")) {
        interventions = [{
          id: Date.now(),
          student: candidate.student.name,
          mentor: candidate.student.mentor,
          date: updatedAt.slice(0, 10),
          notes: `Tier-1 support: review ${candidate.criticalSubjects.join(", ")}.`,
          type: "Institutional intervention",
          status: "Scheduled",
        }, ...interventions];
      }
      return { ...previous, escalationRecords, interventions };
    });
    notify(status === "Actioned" ? "Escalation actioned and intervention state updated." : `Escalation marked ${status.toLowerCase()}.`);
  };

  const visible = candidates.filter((candidate) => filter === "All" || candidate.status === filter);
  const explain = (candidate: EscalationCandidate) => {
    const leading = [...candidate.student.courseRisk.factors].sort((a, b) => b.contribution - a.contribution).slice(0, 2);
    return `Overall risk is ${candidate.student.risk.toFixed(1)} (${candidate.student.status}), driven primarily by ${leading.map((factor) => `${factor.name.toLowerCase()} at ${factor.score}`).join(" and ")}. ${candidate.criticalSubjects.length} courses currently meet the critical threshold.`;
  };

  return (
    <div>
      <AdminHeader title="Institutional Escalations" subtitle="Tier-1 cases are generated from live subject-level risk results." report={{
        type: "admin-escalations",
        title: "Admin Escalation Report",
        period: state.term,
        filters: { Status: filter },
        columns: ["Student", "Department", "Risk Level", "Trigger", "Escalation Tier", "Owner", "Status", "Last Updated"],
        rows: visible.map((candidate) => [candidate.student.name, candidate.student.department, candidate.student.status, candidate.criticalSubjects.join(", "), "Tier 1", candidate.student.mentor, candidate.status, state.escalationRecords[candidate.student.id]?.updatedAt ?? candidate.createdAt]),
        summary: [["Total Escalations", visible.length], ["Active", visible.filter((item) => item.status !== "Closed").length]],
      }} />
      <main className="space-y-5 p-4 sm:p-6">
        <section className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Tier-1 institutional intervention</h2><p className="mt-1 text-xs text-zinc-500">Rule: a student is critical in {normalizeDemoSettings(state.settings).escalationSubjects} or more subjects.</p></div><div className="flex items-center gap-2"><select aria-label="Filter escalations by status" value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2 text-xs text-zinc-300"><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select><Badge tone="bad">{candidates.filter((item) => item.status !== "Closed").length} active</Badge></div></div>
          <div className="overflow-x-auto"><table className="min-w-[900px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Student</th><th className="py-3">Critical subjects</th><th className="py-3">Risk score</th><th className="py-3">Escalation tier</th><th className="py-3">Status</th><th className="py-3">Created date</th><th className="py-3">Action</th></tr></thead><tbody>{visible.map((candidate) => <tr key={candidate.student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3"><button type="button" onClick={() => setSelected(candidate)} className="text-left font-medium text-white hover:text-emerald-100">{candidate.student.name}<span className="ml-2 font-mono text-zinc-500">{candidate.student.rollNo}</span></button></td><td className="py-3">{candidate.criticalSubjects.join(", ")}</td><td className="py-3">{candidate.student.risk.toFixed(1)}</td><td className="py-3">TIER-1</td><td className="py-3"><Badge tone={candidate.status === "Closed" ? "neutral" : candidate.status === "Actioned" ? "good" : candidate.status === "In Review" ? "warn" : "bad"}>{candidate.status}</Badge></td><td className="py-3">{candidate.createdAt ? new Date(candidate.createdAt).toLocaleDateString() : "—"}</td><td className="py-3"><div className="flex gap-1"><button type="button" onClick={() => { setSelected(candidate); changeStatus(candidate, "In Review", false); }} className="rounded-md border border-white/10 px-2 py-1.5 hover:text-white">Review</button><button type="button" disabled={candidate.status === "Actioned" || candidate.status === "Closed"} onClick={() => changeStatus(candidate, "Actioned", true)} className="rounded-md border border-emerald-200/20 px-2 py-1.5 text-emerald-100 disabled:opacity-40">Mark Actioned</button><button type="button" disabled={candidate.status === "Closed"} onClick={() => changeStatus(candidate, "Closed", false)} className="rounded-md border border-white/10 px-2 py-1.5 disabled:opacity-40">Close</button></div></td></tr>)}</tbody></table>{visible.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No escalations match this status.</p> : candidates.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No students currently meet the subject threshold.</p> : null}</div>
        </section>
      </main>
      {selected ? (() => {
        const active = candidates.find((item) => item.student.id === selected.student.id) ?? selected;
        const settings = normalizeDemoSettings(state.settings);
        const strongestFactor = [...active.student.courseRisk.factors].sort((a, b) => b.contribution - a.contribution)[0];
        return <div className="fixed inset-0 z-[80] flex justify-end bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <section role="dialog" aria-modal="true" aria-label="Escalation details" className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0b1213] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-rose-200">Tier-1 institutional intervention</p><h2 className="mt-2 text-2xl font-semibold text-white">{active.student.name}</h2><p className="mt-1 text-sm text-zinc-400">{active.student.rollNo} · {active.student.department}</p></div><button type="button" aria-label="Close escalation details" onClick={() => setSelected(null)} className="rounded-lg border border-white/10 p-2 text-zinc-300"><X className="h-4 w-4" /></button></div>
            <div className="mt-6 grid grid-cols-2 gap-3"><Metric label="Current risk" value={`${active.student.risk.toFixed(1)} · ${active.student.status}`} /><Metric label="Attendance" value={`${active.student.attendance}%`} /><Metric label="Assessment" value={`${active.student.assessmentAverage}%`} /><Metric label="Assignment performance" value={`${active.student.assignmentCompletion}%`} /><Metric label="Academic velocity" value={active.student.velocity.toFixed(2)} /><Metric label="Critical subjects" value={String(active.criticalSubjects.length)} /></div>
            <section className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-4"><h3 className="font-medium text-white">Critical subjects</h3><p className="mt-2 text-sm text-zinc-300">{active.criticalSubjects.join(", ")}</p><h3 className="mt-5 font-medium text-white">Risk explanation</h3><p className="mt-2 text-sm leading-6 text-zinc-400">{explain(active)}</p><h3 className="mt-5 font-medium text-white">Recommended intervention</h3><p className="mt-2 text-sm text-zinc-400">Priority review of {strongestFactor?.name.toLowerCase() ?? "academic progress"} and a coordinated subject recovery plan.</p><p className="mt-5 text-xs text-zinc-500">Current status: {active.status} · Attendance threshold: {settings.attendanceMinimum}%</p></section>
            <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => changeStatus(active, "In Review", true)} className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-2 text-xs text-emerald-100">Start Intervention</button><button type="button" onClick={() => changeStatus(active, "Actioned", true)} className="rounded-xl border border-emerald-200/20 px-3 py-2 text-xs text-emerald-100">Mark Actioned</button><button type="button" onClick={() => changeStatus(active, "Closed", false)} className="rounded-xl border border-white/10 px-3 py-2 text-xs text-zinc-300">Close</button></div>
          </section>
        </div>;
      })() : null}
      <Toast />
    </div>
  );
}

const assessmentOptions: AccreditationAssessment[] = ["Overall", "CIA", "Midterm", "Lab", "Assignment"];

function scoreForAssessment(student: FacultyStudent, assessment: AccreditationAssessment, state: DemoState, course: string) {
  if (assessment === "Overall") return student.subjectMarks[course] ?? student.assessmentAverage;
  const grades = state.gradebook[student.id];
  if (!grades) return student.assessmentAverage;
  if (assessment === "CIA") return grades.cia;
  if (assessment === "Midterm") return grades.midterm;
  if (assessment === "Lab") return grades.lab;
  return grades.assignment;
}

function accreditationStatus(attainment: number, target: number) {
  if (attainment >= target) return "Target achieved";
  if (attainment >= target - 10) return "Near target";
  return "Below target";
}

export function AdminAccreditation() {
  const [state] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const students = getAdminRoster(state);
  const [standard, setStandard] = useState<AccreditationStandard>("NAAC");
  const [course, setCourse] = useState(courses[0]?.name ?? "");
  const [assessment, setAssessment] = useState<AccreditationAssessment>("Overall");
  const [cutoff, setCutoff] = useState(50);
  const [target, setTarget] = useState(70);
  const values = students.map((student) => scoreForAssessment(student, assessment, state, course));
  const calculated = calculateAttainment([{ code: "CO1", title: course, scores: values, targetCutoff: cutoff }])[0];
  const met = values.filter((value) => value >= cutoff).length;
  const status = accreditationStatus(calculated?.attainment ?? 0, target);
  const { notify, Toast } = useToast();

  const exportCsv = () => {
    const headers = ["Course", "Assessment", "Target", "Students Assessed", "Students Meeting Target", "Attainment %", "Status"];
    const row = [course, assessment, `${cutoff}% cutoff; ${target}% attainment`, String(calculated?.studentsAssessed ?? 0), String(met), String(calculated?.attainment ?? 0), status];
    const csv = [headers, row].map((line) => line.map((field) => `"${field.replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lumina-${course.toLowerCase().replaceAll(" ", "-")}-accreditation.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("Accreditation CSV exported.");
  };

  return (
    <div>
      <AdminHeader title="Accreditation Reporting" subtitle="Course outcome attainment calculated from current student demo assessments." report={{
        type: "admin-accreditation",
        title: "Admin Accreditation Report",
        period: state.term,
        filters: { Standard: standard, Course: course, Assessment: assessment, Cutoff: String(cutoff), Target: String(target) },
        columns: ["Metric", "Department", "Numerator", "Denominator", "Percentage", "Status"],
        rows: [[`${standard} attainment · ${course} · ${assessment}`, "Institution", met, calculated?.studentsAssessed ?? 0, `${calculated?.attainment ?? 0}%`, status]],
        summary: [["Students Assessed", calculated?.studentsAssessed ?? 0], ["Target", `${target}%`]],
      }} />
      <main className="space-y-5 p-4 sm:p-6 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.025] p-1" role="tablist" aria-label="Accreditation standard">{standards.map((item) => <button key={item} type="button" role="tab" aria-selected={standard === item} onClick={() => setStandard(item)} className={`rounded-lg px-4 py-2 text-xs font-semibold ${standard === item ? "bg-emerald-200/10 text-emerald-100" : "text-zinc-500 hover:text-white"}`}>{item}</button>)}</div>
          <div className="flex gap-2"><button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-200"><Download className="h-4 w-4" />Export CSV</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-3 py-2.5 text-xs font-semibold text-[#0b1712]"><FileCheck2 className="h-4 w-4" />Print Report</button></div>
        </div>
        <section className={panel}>
          <div className="mb-4"><h2 className="font-semibold text-white">{standard} course outcome attainment</h2><p className="mt-1 text-xs text-zinc-500">Attainment = learners at or above the assessment cutoff ÷ students assessed.</p></div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs text-zinc-400">Course<select aria-label="Accreditation course" value={course} onChange={(event) => setCourse(event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white">{courses.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Assessment<select aria-label="Assessment selection" value={assessment} onChange={(event) => setAssessment(event.target.value as AccreditationAssessment)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white">{assessmentOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="text-xs text-zinc-400">Assessment cutoff (%)<input aria-label="Assessment cutoff" type="number" min={0} max={100} value={cutoff} onChange={(event) => setCutoff(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white" /></label>
            <label className="text-xs text-zinc-400">Target attainment (%)<input aria-label="Target attainment" type="number" min={0} max={100} value={target} onChange={(event) => setTarget(Math.max(0, Math.min(100, Number(event.target.value) || 0)))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white" /></label>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Metric label="Students assessed" value={String(calculated?.studentsAssessed ?? 0)} />
            <Metric label="Students meeting cutoff" value={String(met)} />
            <Metric label="Attainment" value={`${calculated?.attainment ?? 0}%`} />
            <Metric label="Target" value={`${target}%`} />
            <Metric label="Status" value={status} />
          </div>
          <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Course attainment" aria-valuenow={calculated?.attainment ?? 0} aria-valuemin={0} aria-valuemax={100}><div className={`h-full rounded-full ${status === "Target achieved" ? "bg-emerald-300" : status === "Near target" ? "bg-amber-300" : "bg-rose-300"}`} style={{ width: `${calculated?.attainment ?? 0}%` }} /></div>
        </section>
        <section className={panel}><div className="mb-3"><h2 className="font-semibold text-white">Student attainment</h2><p className="mt-1 text-xs text-zinc-500">Scores are current local assessment records; cutoff is {cutoff}%.</p></div><div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Student</th><th className="py-3">Course</th><th className="py-3">Assessment score</th><th className="py-3">Target status</th></tr></thead><tbody>{students.map((student) => { const score = scoreForAssessment(student, assessment, state, course); return <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3">{student.name} · {student.rollNo}</td><td className="py-3">{course}</td><td className="py-3">{score.toFixed(1)}%</td><td className="py-3"><Badge tone={score >= cutoff ? "good" : "bad"}>{score >= cutoff ? "Meeting target" : "Below cutoff"}</Badge></td></tr>; })}</tbody></table></div></section>
      </main>
      <article className="hidden p-10 text-black print:block">
        <p className="text-sm font-semibold uppercase tracking-widest">Lumina AI</p><h1 className="mt-3 text-3xl font-bold">Accreditation Attainment Report</h1>
        <div className="mt-8 grid grid-cols-2 gap-5 text-sm"><p><strong>Course:</strong> {course}</p><p><strong>Assessment:</strong> {assessment}</p><p><strong>Target cutoff:</strong> {cutoff}%</p><p><strong>Target attainment:</strong> {target}%</p><p><strong>Attainment:</strong> {calculated?.attainment ?? 0}%</p><p><strong>Students assessed:</strong> {calculated?.studentsAssessed ?? 0}</p><p><strong>Students meeting target:</strong> {met}</p><p><strong>Date:</strong> {new Date().toISOString().slice(0, 10)}</p></div>
        <p className="mt-8 rounded border p-4">Summary: {course} attained {calculated?.attainment ?? 0}% on {assessment}, {status.toLowerCase()} against the {target}% target.</p>
      </article>
      <Toast />
    </div>
  );
}

export function AdminParentGateway() {
  const [state, setState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const students = getAdminRoster(state);
  const communications = students.flatMap((student) => {
    const trigger = parentCommunicationTrigger(student, state);
    return trigger ? [{ student, trigger }] : [];
  });
  const parentReport: ReportDocument = {
    type: "admin-parent-gateway",
    title: "Admin Parent Gateway Report",
    period: state.term,
    columns: ["Student", "Department", "Parent Gateway Status", "Message / Notification", "Sent Date", "Delivery Status"],
    rows: communications.map(({ student, trigger }) => {
      const record = state.parentContactRecords[student.id];
      const sent = record?.status === "Sent" || state.dispatchedParentIds.includes(student.id);
      return [student.name, student.department, sent ? "Sent" : "Pending", trigger, record?.updatedAt ?? "—", sent ? "Sent (simulated)" : "Pending"];
    }),
    summary: [["Notifications", communications.length], ["Sent", communications.filter(({ student }) => state.parentContactRecords[student.id]?.status === "Sent" || state.dispatchedParentIds.includes(student.id)).length]],
  };
  const { notify, Toast } = useToast();

  const markSent = (studentId: number) => {
    const updatedAt = currentDateTime();
    setState((previous) => ({
      ...previous,
      dispatchedParentIds: [...new Set([...previous.dispatchedParentIds, studentId])],
      parentContactRecords: {
        ...previous.parentContactRecords,
        [studentId]: { status: "Sent", updatedAt },
      },
    }));
    notify("Demo notification marked as sent.");
  };

  return (
    <div>
      <AdminHeader title="Demo Notification Gateway" subtitle="Simulated parent communication tracking. No messages are sent." report={parentReport} />
      <main className="space-y-5 p-4 sm:p-6">
        <section className="rounded-2xl border border-amber-200/20 bg-amber-200/[0.05] p-4"><p className="font-semibold text-amber-100">DEMO NOTIFICATION GATEWAY</p><p className="mt-1 text-sm text-zinc-300">Demo only — no real message was sent. This workflow does not send WhatsApp, SMS, or email.</p></section>
        <section className={panel}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Students requiring parent communication</h2><p className="mt-1 text-xs text-zinc-500">Triggers are derived from current risk, attendance, and assessment data.</p></div><Badge tone="warn">{communications.length} students</Badge></div>
          <div className="overflow-x-auto"><table className="min-w-[850px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Student</th><th className="py-3">Risk</th><th className="py-3">Trigger</th><th className="py-3">Parent contact status</th><th className="py-3">Last updated</th><th className="py-3">Action</th></tr></thead><tbody>{communications.map(({ student, trigger }) => { const record = state.parentContactRecords?.[student.id]; const sent = record?.status === "Sent" || state.dispatchedParentIds.includes(student.id); const updatedAt = record?.updatedAt; return <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3"><span className="font-medium text-white">{student.name}</span><span className="ml-2 text-zinc-500">{student.rollNo}</span></td><td className="py-3">{student.risk.toFixed(1)} · {student.status}</td><td className="py-3">{trigger}</td><td className="py-3"><Badge tone={sent ? "good" : "warn"}>{sent ? "Sent" : "Pending"}</Badge></td><td className="py-3">{updatedAt ? new Date(updatedAt).toLocaleString() : "—"}</td><td className="py-3"><button type="button" disabled={sent} onClick={() => markSent(student.id)} className="rounded-lg border border-emerald-200/20 bg-emerald-200/[0.06] px-3 py-2 text-[11px] text-emerald-100 disabled:opacity-40">{sent ? "Sent" : "Send Demo Notification"}</button></td></tr>; })}</tbody></table>{communications.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No students currently meet the communication triggers.</p> : null}</div>
        </section>
      </main>
      <Toast />
    </div>
  );
}

export function AdminSettings() {
  const [state, setState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const [draft, setDraft] = useState<DemoSettings>(() => normalizeDemoSettings(state.settings));
  const [resetOpen, setResetOpen] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const { notify, Toast } = useToast();
  useEffect(() => {
    startTransition(() => setDraft(normalizeDemoSettings(state.settings)));
  }, [state.settings]);
  const update = <K extends keyof DemoSettings>(key: K, value: DemoSettings[K]) => setDraft((previous) => ({ ...previous, [key]: value }));

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft.institutionName.trim()) {
      notify("Enter an institution name before saving.");
      return;
    }
    const next = normalizeDemoSettings({
      ...draft,
      attendanceMinimum: Math.max(1, Math.min(100, draft.attendanceMinimum)),
      moderateRiskThreshold: Math.max(0, Math.min(99, draft.moderateRiskThreshold)),
      criticalRiskThreshold: Math.max(draft.moderateRiskThreshold, Math.min(100, draft.criticalRiskThreshold)),
      escalationSubjects: Math.max(1, Math.floor(draft.escalationSubjects)),
    });
    setState((previous) => ({ ...previous, settings: next, term: next.academicTerm }));
    setDraft(next);
    notify("Settings saved to the local demo state.");
  };

  const reset = () => {
    setDraft(DEMO_SETTINGS);
    setState((previous) => ({ ...previous, settings: DEMO_SETTINGS, term: DEMO_SETTINGS.academicTerm }));
    notify("Demo settings reset to centralized defaults.");
  };

  const resetAllDemoData = () => {
    setState(INITIAL_DEMO_STATE);
    setDraft(DEMO_SETTINGS);
    setResetOpen(false);
    notify("Demo data reset successfully.");
  };

  const sendTestEmail = async () => {
    setSendingTestEmail(true);
    try {
      const response = await fetch("/api/email/test", { method: "POST" });
      const result = await response.json() as {
        success?: boolean;
        recipient?: string;
        timestamp?: string;
        errorMessage?: string;
        error?: string;
      };
      if (!response.ok || !result.success) {
        throw new Error(result.errorMessage ?? result.error ?? "Test email delivery failed.");
      }
      notify(`Test email sent to ${result.recipient ?? "Admin"} at ${result.timestamp ?? "now"}.`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Test email delivery failed.", true);
    } finally {
      setSendingTestEmail(false);
    }
  };

  const numberInput = (key: "attendanceMinimum" | "moderateRiskThreshold" | "criticalRiskThreshold" | "escalationSubjects", label: string, min: number, max: number) => (
    <label className="block text-xs text-zinc-400">{label}<input type="number" min={min} max={max} value={draft[key]} onChange={(event) => update(key, Number(event.target.value))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white" /></label>
  );

  return (
    <div>
      <AdminHeader title="Demo Configuration" subtitle="Configure centralized institution, attendance, and risk settings." />
      <main className="space-y-5 p-4 sm:p-6">
        <form onSubmit={save} className={panel}>
          <div className="mb-5"><h2 className="font-semibold text-white">Institution settings</h2><p className="mt-1 text-xs text-zinc-500">Changes apply to shared student, faculty, and admin risk calculations.</p></div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <label className="block text-xs text-zinc-400">Institution name<input value={draft.institutionName} onChange={(event) => update("institutionName", event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white" /></label>
            {numberInput("attendanceMinimum", "Attendance threshold (%)", 1, 100)}
            {numberInput("moderateRiskThreshold", "Moderate risk threshold", 0, 99)}
            {numberInput("criticalRiskThreshold", "Critical risk threshold", draft.moderateRiskThreshold, 100)}
            {numberInput("escalationSubjects", "Critical subjects for escalation", 1, courses.length)}
            <label className="block text-xs text-zinc-400">Academic term<select value={draft.academicTerm} onChange={(event) => update("academicTerm", event.target.value)} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-white"><option>Fall 2026</option><option>Spring 2026</option><option>Fall 2025</option></select></label>
            {([
              ["notifyCriticalRisk", "Notify on critical risk"],
              ["notifyAttendanceRisk", "Notify on low attendance"],
              ["emailDigestEnabled", "Enable hourly academic digest emails"],
              ["emailDigestSendOnlyOnChange", "Send digest only on meaningful change"],
              ["emailDigestCompactSummary", "Send compact summary when idle"],
              ["immediateCriticalAlertsEnabled", "Enable immediate critical alerts"],
              ["demoMode", "Demo mode enabled"],
            ] as const).map(([key, label]) => <label key={key} className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-3 text-xs text-zinc-300"><input type="checkbox" checked={draft[key]} onChange={(event) => update(key, event.target.checked)} className="accent-emerald-300" />{label}</label>)}
          </div>
          <div className="mt-6 flex flex-wrap gap-2"><button type="submit" className="rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]">Save Settings</button><button type="button" onClick={reset} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-zinc-300 hover:text-white">Reset Demo Settings</button><button type="button" onClick={() => setResetOpen(true)} className="rounded-xl border border-rose-200/20 px-4 py-2.5 text-xs text-rose-100 hover:bg-rose-200/[0.06]">Reset Demo Data</button></div>
        </form>
        {process.env.NODE_ENV !== "production" ? <section className={panel}><h2 className="font-semibold text-white">Email delivery test</h2><p className="mt-1 text-xs text-zinc-500">Sends a test email to the configured Admin address. Available in development only.</p><button type="button" disabled={sendingTestEmail} onClick={() => void sendTestEmail()} className="mt-4 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.06] px-4 py-2.5 text-xs font-semibold text-emerald-100 disabled:opacity-50">{sendingTestEmail ? "Sending..." : "Send Test Email"}</button></section> : null}
        <section className={panel}><h2 className="font-semibold text-white">Risk weights</h2><p className="mt-1 text-xs text-zinc-500">Weights remain centrally configured to avoid conflicting per-page risk formulas.</p><div className="mt-4 grid gap-2 sm:grid-cols-5">{[["Attendance", draft.attendanceWeight], ["Assessment", draft.assessmentWeight], ["Assignment", draft.assignmentWeight], ["Lab", draft.labWeight], ["Velocity", draft.velocityWeight]].map(([label, weight]) => <Metric key={String(label)} label={String(label)} value={`${weight}%`} />)}</div></section>
      </main>
      {resetOpen ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="reset-demo-title" className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111a1b] p-5 shadow-2xl"><h2 id="reset-demo-title" className="text-lg font-semibold text-white">Reset all demo data?</h2><p className="mt-2 text-sm leading-6 text-zinc-400">This restores the original student, attendance, grade, recovery, intervention, escalation, parent gateway, notification, and settings data in this browser.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setResetOpen(false)} className="rounded-xl border border-white/10 px-4 py-2.5 text-xs text-zinc-300 hover:text-white">Cancel</button><button type="button" onClick={resetAllDemoData} className="rounded-xl bg-rose-200 px-4 py-2.5 text-xs font-semibold text-[#241111]">Reset Demo Data</button></div></section></div> : null}
      <Toast />
    </div>
  );
}
