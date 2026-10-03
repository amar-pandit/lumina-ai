"use client";

import Link from "next/link";
import { useEffect, useState, startTransition } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight, BellRing, BookOpenCheck, CalendarDays, Check, CircleHelp, Download, ExternalLink, FileCheck2, X } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { courses } from "@/lib/demo-data";
import { calculateAttainment, attainmentCsv, type OutcomeAttainment } from "@/lib/accreditation-engine";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getDemoRoster, type DemoSettings } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";

export type DemoModuleKind =
  | "subjects"
  | "prescriptions"
  | "benchmarks"
  | "calendar"
  | "admin-dashboard"
  | "departments"
  | "escalations"
  | "accreditation"
  | "parent-gateway"
  | "settings";

interface DemoModuleProps {
  module: DemoModuleKind;
}

interface Assessment {
  label: string;
  score: number;
  maximum: number;
  weight: number;
}

interface Subject {
  code: string;
  name: string;
  instructor: string;
  mastery: number;
  weakTopic: string;
  assessments: Assessment[];
  trend: number[];
  history: string[];
}

interface CalendarItem {
  id: string;
  title: string;
  course: string;
  type: "Assignment" | "Exam" | "Milestone";
  due: string;
  priority: "High" | "Medium" | "Low";
}

const subjects: Subject[] = [
  { code: "CS204", name: "Data Structures", instructor: "Prof. Arjun Rao", mastery: 42, weakTopic: "Graph traversal and shortest paths", assessments: [{ label: "CIA", score: 18, maximum: 25, weight: 30 }, { label: "Midterm", score: 16, maximum: 30, weight: 25 }, { label: "Lab", score: 25, maximum: 30, weight: 25 }, { label: "Assignment", score: 8, maximum: 15, weight: 20 }], trend: [56, 51, 46, 42], history: ["Quiz 2 · 18/25", "Midterm · 16/30", "Lab 4 · 25/30"] },
  { code: "CS206", name: "Database Systems", instructor: "Dr. Meera Shah", mastery: 61, weakTopic: "Normalization and transaction isolation", assessments: [{ label: "CIA", score: 20, maximum: 25, weight: 30 }, { label: "Midterm", score: 19, maximum: 30, weight: 25 }, { label: "Lab", score: 27, maximum: 30, weight: 25 }, { label: "Assignment", score: 12, maximum: 15, weight: 20 }], trend: [52, 55, 58, 61], history: ["Quiz 2 · 20/25", "Midterm · 19/30", "Lab 4 · 27/30"] },
  { code: "CS208", name: "Operating Systems", instructor: "Prof. N. Iyer", mastery: 74, weakTopic: "Page replacement algorithms", assessments: [{ label: "CIA", score: 21, maximum: 25, weight: 30 }, { label: "Midterm", score: 23, maximum: 30, weight: 25 }, { label: "Lab", score: 26, maximum: 30, weight: 25 }, { label: "Assignment", score: 13, maximum: 15, weight: 20 }], trend: [68, 70, 72, 74], history: ["Quiz 2 · 21/25", "Midterm · 23/30", "Lab 4 · 26/30"] },
  { code: "CS210", name: "Computer Networks", instructor: "Dr. Kavita Menon", mastery: 79, weakTopic: "Congestion control", assessments: [{ label: "CIA", score: 22, maximum: 25, weight: 30 }, { label: "Midterm", score: 24, maximum: 30, weight: 25 }, { label: "Lab", score: 28, maximum: 30, weight: 25 }, { label: "Assignment", score: 13, maximum: 15, weight: 20 }], trend: [70, 72, 76, 79], history: ["Quiz 2 · 22/25", "Midterm · 24/30", "Lab 4 · 28/30"] },
  { code: "CS212", name: "Java Programming", instructor: "Prof. S. Kapoor", mastery: 68, weakTopic: "Interfaces and generics", assessments: [{ label: "CIA", score: 20, maximum: 25, weight: 30 }, { label: "Midterm", score: 20, maximum: 30, weight: 25 }, { label: "Lab", score: 25, maximum: 30, weight: 25 }, { label: "Assignment", score: 12, maximum: 15, weight: 20 }], trend: [62, 64, 66, 68], history: ["Quiz 2 · 20/25", "Midterm · 20/30", "Lab 4 · 25/30"] },
  { code: "MA202", name: "Engineering Mathematics", instructor: "Dr. R. Thomas", mastery: 71, weakTopic: "Eigenvalues and diagonalization", assessments: [{ label: "CIA", score: 19, maximum: 25, weight: 30 }, { label: "Midterm", score: 22, maximum: 30, weight: 25 }, { label: "Lab", score: 25, maximum: 30, weight: 25 }, { label: "Assignment", score: 13, maximum: 15, weight: 20 }], trend: [65, 68, 69, 71], history: ["Quiz 2 · 19/25", "Midterm · 22/30", "Tutorial 4 · 25/30"] },
];

const calendarItems: CalendarItem[] = [
  { id: "dbms-a3", title: "Transaction lab report", course: "Database Systems", type: "Assignment", due: "Oct 06", priority: "High" },
  { id: "dsa-test", title: "Graph algorithms quiz", course: "Data Structures", type: "Exam", due: "Oct 08", priority: "High" },
  { id: "attendance-75", title: "Reach 75% attendance", course: "Academic milestone", type: "Milestone", due: "Oct 12", priority: "High" },
  { id: "os-a2", title: "Memory management worksheet", course: "Operating Systems", type: "Assignment", due: "Oct 14", priority: "Medium" },
  { id: "java-lab", title: "Generics practical", course: "Java Programming", type: "Assignment", due: "Oct 17", priority: "Medium" },
];

const moduleInfo: Record<DemoModuleKind, { title: string; subtitle: string; workspace: "Student" | "Institution" }> = {
  subjects: { title: "Subjects & Assessment", subtitle: "Course mastery, weighted marks, and the topics to focus on next.", workspace: "Student" },
  prescriptions: { title: "Study Prescriptions", subtitle: "Demo recommendations grounded in your current course signals.", workspace: "Student" },
  benchmarks: { title: "Cohort Benchmarks", subtitle: "Your academic position alongside anonymized cohort patterns.", workspace: "Student" },
  calendar: { title: "Academic Calendar", subtitle: "Upcoming work, recovery milestones, and study consistency.", workspace: "Student" },
  "admin-dashboard": { title: "Institution Command Center", subtitle: "Academic risk, attendance compliance, and intervention coverage.", workspace: "Institution" },
  departments: { title: "Department Overview", subtitle: "Retention, attendance, attainment, and course health by department.", workspace: "Institution" },
  escalations: { title: "Institutional Escalations", subtitle: "Apply the PRD threshold for Tier-1 institutional intervention.", workspace: "Institution" },
  accreditation: { title: "Accreditation Reporting", subtitle: "Calculated course-outcome attainment from the demo assessment cohort.", workspace: "Institution" },
  "parent-gateway": { title: "Parent Notification Gateway", subtitle: "Preview and simulate guardian notifications. No messages are sent.", workspace: "Institution" },
  settings: { title: "Demo Configuration", subtitle: "Adjust and save academic thresholds and risk weights locally.", workspace: "Institution" },
};

const panelClass = "rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5";
const departments = ["Computer Science", "Information Technology", "Electronics", "Mechanical"];
const riskOptions = ["All", "Critical", "Moderate", "Safe"];
const outcomeStandards = ["NAAC", "NBA", "ABET"] as const;
type OutcomeStandard = (typeof outcomeStandards)[number];

function weightedTotal(assessment: Assessment[]) {
  return assessment.reduce((total, item) => total + (item.score / item.maximum) * item.weight, 0);
}

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4"><p className="text-xs text-zinc-500">{label}</p><p className="mt-2 text-2xl font-semibold text-white">{value}</p>{detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}</div>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "critical" | "warning" | "success" }) {
  const tones = { neutral: "border-white/10 bg-white/[0.04] text-zinc-300", critical: "border-rose-300/20 bg-rose-300/[0.08] text-rose-200", warning: "border-amber-200/20 bg-amber-200/[0.08] text-amber-100", success: "border-emerald-200/20 bg-emerald-200/[0.08] text-emerald-100" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${tones[tone]}`}>{children}</span>;
}

export function DemoModule({ module }: DemoModuleProps) {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const completedItems = new Set(demoState.completedCalendarItemIds);
  const reminders = new Set(demoState.reminderIds);
  const startedPlans = new Set(demoState.startedPrescriptionCodes);
  const [activeStandard, setActiveStandard] = useState<OutcomeStandard>("NAAC");
  const escalatedStudents = new Set(demoState.escalatedStudentIds);
  const dispatched = new Set(demoState.dispatchedParentIds);
  const [settingsDraft, setSettingsDraft] = useState<DemoSettings>(demoState.settings);
  const settings = settingsDraft;
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [filters, setFilters] = useState({ department: "All", year: "All", risk: "All", course: "All" });
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (module !== "settings") return;
    startTransition(() => {
      setSettingsDraft(demoState.settings);
      setSettingsLoaded(true);
    });
  }, [demoState.settings, module]);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
    const route = moduleInfo[module].workspace === "Student"
      ? "/student/calendar"
      : "/admin/dashboard";
    setDemoState((previous) => ({
      ...previous,
      notifications: [{ id: `event-${Date.now()}`, message, route, read: false }, ...previous.notifications].slice(0, 20),
    }));
  };

  const cohort = getDemoRoster(demoState);
  const filteredStudents = cohort.filter((student) =>
    (filters.department === "All" || student.department === filters.department)
    && (filters.year === "All" || String(student.year) === filters.year)
    && (filters.risk === "All" || student.status === filters.risk)
    && (filters.course === "All" || student.course === filters.course),
  );
  const info = moduleInfo[module];
  const currentCohortCount = cohort.length;
  const criticalCount = cohort.filter((student) => student.status === "Critical").length;
  const moderateCount = cohort.filter((student) => student.status === "Moderate").length;
  const projectedDebarment = (cohort.filter((student) => student.attendance < demoState.settings.attendanceMinimum).length / currentCohortCount) * 100;
  const studentPercentile = Math.round((cohort.filter((student) => student.risk < 44.3).length / currentCohortCount) * 100);

  const outcomeInputs: OutcomeAttainment[] = [
    { code: "CO1", title: "Apply core concepts", scores: cohort.map((student) => student.assessmentAverage), targetCutoff: 50 },
    { code: "CO2", title: "Analyze technical problems", scores: cohort.map((student) => Math.max(0, student.assessmentAverage + ((student.id % 5) - 2) * 4)), targetCutoff: 60 },
    { code: "CO3", title: "Design a practical solution", scores: cohort.map((student) => Math.min(100, student.labCompletion)), targetCutoff: 60 },
    { code: "CO4", title: "Communicate and collaborate", scores: cohort.map((student) => student.assignmentCompletion), targetCutoff: 55 },
  ];
  const attainmentRows = calculateAttainment(outcomeInputs);
  const averageRisk = cohort.reduce((total, student) => total + student.risk, 0) / currentCohortCount;
  const attendanceCompliance = 100 - projectedDebarment;
  const weeklyTrend = Array.from({ length: 6 }, (_, index) => {
    const historicalOffset = (5 - index) * 1.8;
    return {
      risk: Math.min(100, averageRisk + historicalOffset),
      compliance: Math.max(0, Math.min(100, attendanceCompliance - (5 - index) * 1.2)),
    };
  });
  const completedInterventions = demoState.interventions.filter((intervention) => intervention.status === "Completed").length;
  const interventionRecovery = demoState.interventions.length === 0
    ? 0
    : Math.round((completedInterventions / demoState.interventions.length) * 100);

  const saveSettings = () => {
    setDemoState((previous) => ({ ...previous, settings: settingsDraft, term: settingsDraft.academicTerm }));
    notify("Demo settings saved in this browser.");
  };

  const updateSetting = (key: keyof DemoSettings, value: string) => {
    setSettingsDraft((previous) => ({ ...previous, [key]: key === "academicTerm" ? value : Number(value) }));
  };

  const downloadCsv = () => {
    const contents = attainmentCsv(attainmentRows);
    const blob = new Blob([contents], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `lumina-${activeStandard.toLowerCase()}-attainment-demo.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify("CSV report downloaded.");
  };

  const renderStudentSubjects = () => (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm text-zinc-300">Semester 4 · {subjects.length} active courses</p><p className="mt-1 text-xs text-zinc-500">Weighted total combines CIA, midterm, lab, and assignment scores.</p></div>
        <StatusPill tone="warning">1 course needs focus</StatusPill>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {subjects.map((subject) => {
          const total = weightedTotal(subject.assessments);
          return <button key={subject.code} type="button" onClick={() => setSelectedSubject(subject)} className="group rounded-xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-emerald-200/25 hover:bg-white/[0.045]">
            <div className="flex items-start justify-between gap-3"><span className="text-[10px] font-semibold uppercase text-zinc-500">{subject.code}</span><StatusPill tone={subject.mastery < 50 ? "critical" : subject.mastery < 65 ? "warning" : "success"}>{subject.mastery}% mastery</StatusPill></div>
            <h2 className="mt-3 text-base font-semibold text-white">{subject.name}</h2><p className="mt-1 text-xs text-zinc-500">{subject.instructor}</p>
            <div className="mt-4 flex items-end justify-between"><span className="text-xs text-zinc-500">Weighted total</span><span className="text-2xl font-semibold text-white">{total.toFixed(1)}<span className="text-sm text-zinc-500">%</span></span></div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${subject.mastery < 50 ? "bg-rose-300" : "bg-emerald-300"}`} style={{ width: `${subject.mastery}%` }} /></div>
            <p className="mt-3 truncate text-xs text-zinc-400">Focus: {subject.weakTopic}</p>
            <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-emerald-200">Assessment history <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" /></span>
          </button>;
        })}
      </div>
    </>
  );

  const renderPrescriptions = () => (
    <div className="space-y-3">
      {subjects.filter((subject) => subject.mastery < 75).map((subject, index) => {
        const started = startedPlans.has(subject.code);
        const priority = index === 0 ? "High" : index < 3 ? "Medium" : "Low";
        return <article key={subject.code} className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.025] p-4 lg:grid-cols-[minmax(0,1fr)_15rem_auto] lg:items-center">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200/15 bg-emerald-200/[0.06] text-emerald-100"><BookOpenCheck className="h-4 w-4" /></span><div><p className="text-[10px] font-semibold uppercase text-zinc-500">{subject.name} · weak topic</p><h2 className="mt-1 font-medium text-white">{subject.weakTopic}</h2><p className="mt-1 text-xs text-zinc-400">Review a guided example, then complete 3 practice questions.</p></div></div>
          <div className="text-xs text-zinc-400"><p className="font-medium text-zinc-200">Demo resource suggestion</p><p className="mt-1">{subject.name === "Data Structures" ? "Textbook: Graph Theory, chapter 6" : "Course notes: targeted review section"}</p><p className="mt-1 text-zinc-500">{20 + index * 10} min · {priority} priority</p></div>
          <button type="button" onClick={() => { setDemoState((previous) => { if (previous.startedPrescriptionCodes.includes(subject.code)) return previous; const nextId = Math.max(0, ...previous.recoveryTasks.map((task) => task.id)) + 1; const dayNumber = previous.recoveryTasks.length + 1; return { ...previous, startedPrescriptionCodes: [...previous.startedPrescriptionCodes, subject.code], recoveryTasks: [...previous.recoveryTasks, { id: nextId, title: `Study ${subject.weakTopic}`, duration: `${20 + index * 10} min`, priority, day: `Day ${dayNumber}` }] }; }); notify(`${subject.name} recovery task added to your plan.`); }} disabled={started} className="rounded-xl border border-emerald-200/20 bg-emerald-200/[0.07] px-4 py-2.5 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-200/[0.13] disabled:cursor-default disabled:opacity-60">{started ? "Plan started" : "Start recovery"}</button>
        </article>;
      })}
      <p className="flex items-center gap-2 rounded-xl border border-amber-200/10 bg-amber-200/[0.04] p-3 text-xs text-zinc-400"><CircleHelp className="h-4 w-4 shrink-0 text-amber-100" />Recommendations and resources are generated from demo data; no external content was retrieved.</p>
    </div>
  );

  const renderBenchmarks = () => {
    const scores = cohort.map((student) => student.assessmentAverage).sort((left, right) => left - right);
    const median = scores[Math.floor(scores.length / 2)] ?? 0;
    const bands = [{ label: "0–39", count: scores.filter((score) => score < 40).length }, { label: "40–59", count: scores.filter((score) => score >= 40 && score < 60).length }, { label: "60–79", count: scores.filter((score) => score >= 60 && score < 80).length }, { label: "80–100", count: scores.filter((score) => score >= 80).length }];
    if (currentCohortCount < 15) return <section className={panelClass}><Metric label="Cohort median" value={`${median}%`} detail="Small cohorts only show a median." /><p className="mt-3 text-xs text-zinc-500">Cohort insights are anonymized.</p></section>;
    return <>
      <div className="grid gap-3 md:grid-cols-3"><Metric label="Cohort median" value={`${median}%`} detail={`${currentCohortCount} anonymized learners`} /><Metric label="Your percentile" value={`${studentPercentile}th`} detail="Assessment average" /><Metric label="Your assessment average" value={`${cohort.find((student) => student.id === 1)?.assessmentAverage ?? 0}%`} detail="Current term" /></div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]"><section className={panelClass}><h2 className="font-semibold text-white">Assessment distribution</h2><div className="mt-5 space-y-4">{bands.map((band) => <div key={band.label}><div className="mb-1.5 flex justify-between text-xs text-zinc-400"><span>{band.label}</span><span>{band.count} students</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-cyan-300" style={{ width: `${(band.count / currentCohortCount) * 100}%` }} /></div></div>)}</div></section><section className={panelClass}><h2 className="font-semibold text-white">Subject comparison</h2><div className="mt-5 space-y-4">{courses.map((course) => <div key={course.name}><div className="mb-1.5 flex justify-between text-xs text-zinc-400"><span>{course.name}</span><span>{course.score}%</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${course.score}%` }} /></div></div>)}</div></section></div>
      <p className="mt-4 rounded-xl border border-white/10 bg-white/[0.025] p-3 text-xs text-zinc-400">Cohort insights are anonymized. {currentCohortCount < 15 ? "Cohort size is below 15; only the median is shown." : "Individual cohort records are not displayed."}</p>
    </>;
  };

  const renderCalendar = () => (
    <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3"><Metric label="Attendance recovery streak" value={`${completedItems.has("attendance-75") ? 7 : 0} days`} detail="Current run" /><Metric label="Assignment streak" value={`${calendarItems.filter((item) => item.type === "Assignment" && completedItems.has(item.id)).length} days`} detail="On-time submissions" /><Metric label="Consistency badge" value={completedItems.size >= 2 ? "Earned" : "In progress"} detail="Complete 2 milestones" /></div>
      <section className={panelClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Upcoming work</h2><p className="mt-1 text-xs text-zinc-500">October 2026 · reminders are local demo state</p></div><CalendarDays className="h-5 w-5 text-emerald-200" /></div><div className="divide-y divide-white/[0.07]">{calendarItems.map((item) => { const isComplete = completedItems.has(item.id); const reminderOn = reminders.has(item.id); return <div key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_7rem_auto] sm:items-center"><div className="flex items-start gap-3"><button type="button" aria-label={`${isComplete ? "Mark incomplete" : "Mark complete"}: ${item.title}`} aria-pressed={isComplete} onClick={() => setDemoState((previous) => ({ ...previous, completedCalendarItemIds: isComplete ? previous.completedCalendarItemIds.filter((id) => id !== item.id) : [...previous.completedCalendarItemIds, item.id] }))} className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${isComplete ? "border-emerald-200/30 bg-emerald-200/15 text-emerald-100" : "border-white/15 text-zinc-500 hover:border-emerald-200/30"}`}>{isComplete ? <Check className="h-3.5 w-3.5" /> : null}</button><div><p className={`text-sm font-medium ${isComplete ? "text-zinc-500 line-through" : "text-white"}`}>{item.title}</p><p className="mt-1 text-xs text-zinc-500">{item.course} · {item.type}</p></div></div><div className="flex items-center gap-2 sm:block"><p className="text-xs text-zinc-300">Due {item.due}</p><StatusPill tone={item.priority === "High" ? "critical" : item.priority === "Medium" ? "warning" : "success"}>{item.priority}</StatusPill></div><button type="button" aria-pressed={reminderOn} onClick={() => setDemoState((previous) => ({ ...previous, reminderIds: reminderOn ? previous.reminderIds.filter((id) => id !== item.id) : [...previous.reminderIds, item.id] }))} className="inline-flex items-center gap-1.5 justify-self-start rounded-lg border border-white/10 px-2.5 py-2 text-xs text-zinc-300 hover:border-white/20 sm:justify-self-end"><BellRing className="h-3.5 w-3.5" />{reminderOn ? "Reminder on" : "Set reminder"}</button></div>; })}</div></section>
    </>
  );

  const renderAdminDashboard = () => (
    <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><Metric label="Students monitored" value={String(currentCohortCount)} /><Metric label="Critical risk" value={String(criticalCount)} /><Metric label="Moderate risk" value={String(moderateCount)} /><Metric label="Projected debarment" value={`${projectedDebarment.toFixed(1)}%`} /><Metric label="Attendance compliance" value={`${attendanceCompliance.toFixed(1)}%`} /><Metric label="Intervention recovery" value={`${interventionRecovery}%`} detail={`${completedInterventions} of ${demoState.interventions.length} completed`} /></div>
      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"><section className={panelClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Risk and attendance trend</h2><p className="mt-1 text-xs text-zinc-500">Six-week trend projected from the current demo cohort.</p></div><StatusPill>6 weeks</StatusPill></div><div className="grid h-40 grid-cols-6 items-end gap-3">{weeklyTrend.map((point, index) => <div key={index} className="flex h-full flex-col items-center justify-end gap-2"><div className="flex w-full items-end gap-1" style={{ height: "82%" }}><span className="w-1/2 rounded-t bg-rose-300/70" style={{ height: `${point.risk}%` }} /><span className="w-1/2 rounded-t bg-emerald-300/60" style={{ height: `${point.compliance}%` }} /></div><span className="text-[10px] text-zinc-500">W{index + 1}</span></div>)}</div><div className="mt-3 flex gap-4 text-[10px] text-zinc-500"><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-rose-300" />Risk index</span><span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-300" />Attendance compliance</span></div></section><section className={panelClass}><h2 className="font-semibold text-white">Department comparison</h2><div className="mt-5 space-y-4">{departments.map((department) => { const group = cohort.filter((student) => student.department === department); const average = group.reduce((total, student) => total + student.assessmentAverage, 0) / Math.max(group.length, 1); return <div key={department}><div className="mb-1.5 flex justify-between gap-2 text-xs text-zinc-400"><span>{department}</span><span>{average.toFixed(0)}% attainment</span></div><div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300/80" style={{ width: `${average}%` }} /></div></div>; })}</div></section></div>
      <section className={panelClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Institutional risk register</h2><p className="mt-1 text-xs text-zinc-500">Filter the 60-student demo cohort by department, year, course, and risk.</p></div><Link href="/admin/escalations" className="inline-flex items-center gap-1.5 text-xs text-emerald-200 hover:text-white">Escalations <ArrowUpRight className="h-3.5 w-3.5" /></Link></div><div className="mb-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{(["department", "year", "risk", "course"] as const).map((key) => <select key={key} aria-label={`Filter by ${key}`} value={filters[key]} onChange={(event) => setFilters((previous) => ({ ...previous, [key]: event.target.value }))} className="rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2 text-xs text-zinc-300"><option value="All">All {key === "year" ? "years" : `${key}s`}</option>{(key === "department" ? departments : key === "risk" ? riskOptions.slice(1) : key === "course" ? courses.map((course) => course.name) : ["1", "2", "3", "4"]).map((value) => <option key={value}>{value}</option>)}</select>)}</div><div className="overflow-x-auto"><table className="min-w-[920px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3 pr-4">Student · Roll</th><th className="py-3 pr-4">Department</th><th className="py-3 pr-4">Risk</th><th className="py-3 pr-4">Velocity</th><th className="py-3 pr-4">Attendance</th><th className="py-3 pr-4">Risk drivers</th><th className="py-3 pr-4">Mentor</th><th className="py-3">Action</th></tr></thead><tbody>{filteredStudents.slice(0, 12).map((student) => <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3 pr-4"><span className="font-medium text-white">{student.name}</span><span className="ml-2 text-zinc-500">{student.rollNo}</span></td><td className="py-3 pr-4">{student.department}</td><td className="py-3 pr-4"><StatusPill tone={student.status === "Critical" ? "critical" : student.status === "Moderate" ? "warning" : "success"}>{student.risk.toFixed(1)} · {student.status}</StatusPill></td><td className="py-3 pr-4">{student.velocity.toFixed(2)}</td><td className="py-3 pr-4">{student.attendance}%</td><td className="py-3 pr-4">{student.riskDrivers.slice(0, 2).join(", ") || "Stable"}</td><td className="py-3 pr-4">{student.mentor}</td><td className="py-3"><Link href="/faculty/interventions" className="text-emerald-200 hover:text-white">Review</Link></td></tr>)}</tbody></table>{filteredStudents.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No students match those filters.</p> : null}</div></section>
    </>
  );

  const renderDepartments = () => (
    <div className="grid gap-3 md:grid-cols-2">{departments.map((department) => { const group = cohort.filter((student) => student.department === department); const averageAttendance = group.reduce((total, student) => total + student.attendance, 0) / Math.max(group.length, 1); const attainment = group.reduce((total, student) => total + student.assessmentAverage, 0) / Math.max(group.length, 1); const critical = group.filter((student) => student.status === "Critical").length; return <section key={department} className={panelClass}><div className="flex items-start justify-between"><div><p className="text-[10px] font-semibold uppercase text-zinc-500">Department demo</p><h2 className="mt-2 text-lg font-semibold text-white">{department}</h2></div><StatusPill>{group.length} students</StatusPill></div><div className="mt-5 grid grid-cols-2 gap-3"><Metric label="Retention trend" value={`${Math.max(0, 100 - critical)}%`} detail="Calculated demo outlook" /><Metric label="Average attendance" value={`${averageAttendance.toFixed(1)}%`} /><Metric label="Average attainment" value={`${attainment.toFixed(1)}%`} /><Metric label="Critical students" value={String(critical)} /></div><div className="mt-4"><p className="mb-2 text-xs text-zinc-500">Course health</p><div className="flex flex-wrap gap-2">{courses.slice(0, 4).map((course) => <StatusPill key={course.name} tone={course.score < 50 ? "critical" : course.score < 65 ? "warning" : "success"}>{course.name} · {course.score}%</StatusPill>)}</div></div></section>; })}</div>
  );

  const renderEscalations = () => {
    const candidates = cohort.filter((student) => student.status === "Critical" && student.criticalSubjects.length >= demoState.settings.escalationSubjects);
    return <section className={panelClass}><div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">Tier-1 candidates</h2><p className="mt-1 text-xs text-zinc-500">Rule: critical in {demoState.settings.escalationSubjects} or more subjects triggers institutional review.</p></div><Metric label="Open escalations" value={String(escalatedStudents.size)} /></div><div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3 pr-4">Priority</th><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Critical subjects</th><th className="py-3 pr-4">Mentor</th><th className="py-3 pr-4">HOD</th><th className="py-3">Action</th></tr></thead><tbody>{candidates.slice(0, 15).map((student) => { const triggered = escalatedStudents.has(student.id); return <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3 pr-4"><StatusPill tone="critical">Tier 1</StatusPill></td><td className="py-3 pr-4"><span className="font-medium text-white">{student.name}</span><span className="ml-2 text-zinc-500">{student.rollNo}</span></td><td className="py-3 pr-4">{student.criticalSubjects.slice(0, demoState.settings.escalationSubjects).join(", ")}</td><td className="py-3 pr-4">{student.mentor}</td><td className="py-3 pr-4">Dr. R. Khanna</td><td className="py-3"><button type="button" disabled={triggered} onClick={() => { setDemoState((previous) => ({ ...previous, escalatedStudentIds: [...new Set([...previous.escalatedStudentIds, student.id])] })); notify(`Tier-1 escalation created for ${student.name}.`); }} className="rounded-lg border border-rose-200/15 bg-rose-200/[0.07] px-3 py-2 text-[11px] font-medium text-rose-100 hover:bg-rose-200/[0.13] disabled:opacity-50">{triggered ? "Escalated" : "Trigger Tier-1 Escalation"}</button></td></tr>; })}</tbody></table>{candidates.length === 0 ? <p className="py-8 text-center text-sm text-zinc-500">No student currently meets the threshold.</p> : null}</div></section>;
  };

  const renderAccreditation = () => <>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div className="inline-flex rounded-xl border border-white/10 bg-white/[0.025] p-1" role="tablist" aria-label="Accreditation standard">{outcomeStandards.map((standard) => <button key={standard} type="button" role="tab" aria-selected={activeStandard === standard} onClick={() => setActiveStandard(standard)} className={`rounded-lg px-4 py-2 text-xs font-semibold transition ${activeStandard === standard ? "bg-emerald-200/10 text-emerald-100" : "text-zinc-500 hover:text-white"}`}>{standard}</button>)}</div><div className="flex gap-2"><button type="button" onClick={downloadCsv} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-200 hover:border-white/20"><Download className="h-4 w-4" />Generate CSV</button><button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-3 py-2.5 text-xs font-semibold text-[#0b1712] hover:bg-emerald-100"><FileCheck2 className="h-4 w-4" />Generate report</button></div></div>
    <section className={panelClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">{activeStandard} course outcomes</h2><p className="mt-1 text-xs text-zinc-500">Attainment = students scoring at or above target ÷ students assessed.</p></div><StatusPill tone="success">Calculated live</StatusPill></div><div className="overflow-x-auto"><table className="min-w-[620px] w-full text-left text-sm"><thead><tr className="border-b border-white/10 text-xs text-zinc-500"><th className="py-3 pr-4">Outcome</th><th className="py-3 pr-4">Course outcome</th><th className="py-3 pr-4">Attainment</th><th className="py-3 pr-4">Target cutoff</th><th className="py-3">Students assessed</th></tr></thead><tbody>{attainmentRows.map((row) => <tr key={row.code} className="border-b border-white/[0.06] text-zinc-300"><td className="py-4 pr-4 font-mono text-emerald-100">{row.code}</td><td className="py-4 pr-4">{row.title}</td><td className="py-4 pr-4"><div className="flex items-center gap-3"><span className="w-12 font-semibold text-white">{row.attainment}%</span><div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-cyan-300" style={{ width: `${row.attainment}%` }} /></div></div></td><td className="py-4 pr-4">{row.targetCutoff}%</td><td className="py-4">{row.studentsAssessed}</td></tr>)}</tbody></table></div><p className="mt-4 text-[11px] text-zinc-500">Report generation is a printable demo view. No accreditation system is connected.</p></section>
  </>;

  const renderParentGateway = () => {
    const triggeredStudents = cohort.filter((student) => student.attendance < demoState.settings.attendanceMinimum || student.continuousAssessmentFailures >= 2).slice(0, 18);
    return <section className={panelClass}><div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold text-white">Demo Notification Gateway</h2><p className="mt-1 text-xs text-zinc-500">Pending notices are simulated locally. No WhatsApp, SMS, or email is sent.</p></div><StatusPill tone="warning">SIMULATED</StatusPill></div><div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3 pr-4">Student · Guardian</th><th className="py-3 pr-4">Trigger</th><th className="py-3 pr-4">Channel</th><th className="py-3 pr-4">Timestamp</th><th className="py-3">Status</th></tr></thead><tbody>{triggeredStudents.map((student) => { const sent = dispatched.has(student.id); const trigger = student.attendance < 65 ? "Attendance below 65%" : student.attendance < demoState.settings.attendanceMinimum ? `Attendance below ${demoState.settings.attendanceMinimum}%` : "Assessment failure in 2 subjects"; const channel = ["WhatsApp", "SMS", "Email"][student.id % 3]; return <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3 pr-4"><span className="text-white">{student.name}</span><span className="block mt-1 text-zinc-500">Guardian: {student.name.split(" ")[0]} family</span></td><td className="py-3 pr-4">{trigger}</td><td className="py-3 pr-4">{channel}</td><td className="py-3 pr-4">Today · 09:{String(10 + student.id % 49).padStart(2, "0")}</td><td className="py-3">{sent ? <StatusPill tone="success">Sent · simulated</StatusPill> : <button type="button" onClick={() => { setDemoState((previous) => ({ ...previous, dispatchedParentIds: [...new Set([...previous.dispatchedParentIds, student.id])] })); notify(`Demo ${channel} dispatch marked sent.`); }} className="rounded-lg border border-emerald-200/15 px-3 py-2 text-[10px] text-emerald-100 hover:bg-emerald-200/[0.07]">Pending · dispatch</button>}</td></tr>; })}</tbody></table></div></section>;
  };

  const renderSettings = () => <section className={panelClass}><form onSubmit={(event) => { event.preventDefault(); saveSettings(); }} className="space-y-6"><div className="grid gap-4 md:grid-cols-2"><label className="text-xs text-zinc-400">Attendance minimum (%)<input type="number" min={50} max={100} value={settings.attendanceMinimum} onChange={(event) => updateSetting("attendanceMinimum", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Critical risk threshold<input type="number" min={40} max={90} value={settings.criticalRiskThreshold} onChange={(event) => updateSetting("criticalRiskThreshold", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Assessment weight (%)<input type="number" min={0} max={100} value={settings.assessmentWeight} onChange={(event) => updateSetting("assessmentWeight", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Attendance risk weight (%)<input type="number" min={0} max={100} value={settings.attendanceWeight} onChange={(event) => updateSetting("attendanceWeight", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Assignment risk weight (%)<input type="number" min={0} max={100} value={settings.assignmentWeight} onChange={(event) => updateSetting("assignmentWeight", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Lab risk weight (%)<input type="number" min={0} max={100} value={settings.labWeight} onChange={(event) => updateSetting("labWeight", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Velocity risk weight (%)<input type="number" min={0} max={100} value={settings.velocityWeight} onChange={(event) => updateSetting("velocityWeight", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Tier-1 escalation subject threshold<input type="number" min={1} max={6} value={settings.escalationSubjects} onChange={(event) => updateSetting("escalationSubjects", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="text-xs text-zinc-400">Academic term<select value={settings.academicTerm} onChange={(event) => updateSetting("academicTerm", event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white"><option>Fall 2026</option><option>Spring 2026</option><option>Fall 2025</option></select></label></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4"><p className="text-xs text-zinc-500">{settingsLoaded ? "Settings load from and save to this browser." : "Loading saved settings…"}</p><button type="submit" className="rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712] hover:bg-emerald-100">Save settings</button></div></form></section>;

  const bodyByModule: Record<DemoModuleKind, () => React.ReactNode> = {
    subjects: renderStudentSubjects,
    prescriptions: renderPrescriptions,
    benchmarks: renderBenchmarks,
    calendar: renderCalendar,
    "admin-dashboard": renderAdminDashboard,
    departments: renderDepartments,
    escalations: renderEscalations,
    accreditation: renderAccreditation,
    "parent-gateway": renderParentGateway,
    settings: renderSettings,
  };

  return (
    <div>
      <Topbar title={info.title} subtitle={info.subtitle} workspace={info.workspace} />
      <main className="space-y-5 p-4 sm:p-6">
        {bodyByModule[module]()}
      </main>

      {selectedSubject ? (
        <div className="fixed inset-0 z-[70] flex justify-end bg-black/65 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedSubject(null); }}>
          <section role="dialog" aria-modal="true" aria-label={`${selectedSubject.name} details`} className="h-full w-full max-w-xl overflow-y-auto border-l border-white/10 bg-[#0b1213] p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between"><div><p className="text-xs uppercase text-zinc-500">{selectedSubject.code} · Course detail</p><h2 className="mt-2 text-2xl font-semibold text-white">{selectedSubject.name}</h2><p className="mt-1 text-sm text-zinc-400">{selectedSubject.instructor}</p></div><button type="button" aria-label="Close subject details" onClick={() => setSelectedSubject(null)} className="rounded-lg border border-white/10 p-2 text-zinc-300 hover:text-white"><X className="h-4 w-4" /></button></div>
            <div className="mt-7 grid grid-cols-2 gap-3"><Metric label="Course mastery" value={`${selectedSubject.mastery}%`} /><Metric label="Weighted total" value={`${weightedTotal(selectedSubject.assessments).toFixed(1)}%`} /></div>
            <h3 className="mt-7 text-sm font-semibold text-white">Assessment scores</h3><div className="mt-3 space-y-3">{selectedSubject.assessments.map((assessment) => <div key={assessment.label} className="rounded-xl border border-white/10 bg-white/[0.025] p-3"><div className="flex justify-between text-sm"><span className="text-zinc-300">{assessment.label} · {assessment.weight}%</span><span className="font-medium text-white">{assessment.score}/{assessment.maximum}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-300" style={{ width: `${(assessment.score / assessment.maximum) * 100}%` }} /></div></div>)}</div>
            <h3 className="mt-7 text-sm font-semibold text-white">Grade trend</h3><div className="mt-3 flex h-28 items-end gap-2">{selectedSubject.trend.map((value, index) => <div key={index} className="flex flex-1 flex-col items-center gap-2"><span className="text-[10px] text-zinc-500">{value}%</span><div className="w-full rounded-t bg-emerald-300/70" style={{ height: `${value}%` }} /></div>)}</div>
            <h3 className="mt-7 text-sm font-semibold text-white">Weak topic detection</h3><p className="mt-2 rounded-xl border border-amber-200/10 bg-amber-200/[0.04] p-3 text-sm text-amber-100">{selectedSubject.weakTopic}</p>
            <h3 className="mt-7 text-sm font-semibold text-white">Assessment history</h3><ul className="mt-3 space-y-2">{selectedSubject.history.map((entry) => <li key={entry} className="flex items-center gap-2 text-sm text-zinc-400"><ArrowDownRight className="h-3.5 w-3.5 text-cyan-200" />{entry}</li>)}</ul>
            <Link href="/student/academics/prescriptions" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]">View study prescription <ExternalLink className="h-3.5 w-3.5" /></Link>
          </section>
        </div>
      ) : null}

      {toast ? <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl border border-emerald-200/20 bg-[#102019] px-4 py-3 text-sm text-emerald-100 shadow-xl"><Check className="h-4 w-4" />{toast}</div> : null}
    </div>
  );
}
