"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CheckCircle2, CircleAlert, FileSpreadsheet, Keyboard, Mic, Plus, Save, Search, Users, X } from "lucide-react";
import { calculateRisk } from "@/lib/risk-engine";
import { facultyStudents } from "@/lib/demo-data";
import { parseVoiceCommand, type ParsedAttendanceRow } from "@/lib/voice-parser";
import { DemoControls } from "@/components/layout/DemoControls";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, countsAsAttending, getDemoRoster, type DemoAttendanceStatus, type DemoGradeRecord, type DemoInterventionStatus } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";
import { ReportExportButton } from "@/components/reports/ReportExportButton";
import type { ReportDocument } from "@/lib/reports/types";
import { useDemoSession } from "@/components/auth/useDemoSession";
import { HOD_DEPARTMENT } from "@/lib/hod-data";

export type FacultyToolKind = "voice" | "grid" | "gradebook" | "heatmap" | "remedial" | "interventions";

type AttendanceStatus = DemoAttendanceStatus;
type InterventionStatus = DemoInterventionStatus;
type GradeRecord = DemoGradeRecord;

const panel = "min-w-0 rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5";
const attendanceStatuses: AttendanceStatus[] = ["Present", "Absent", "On Duty", "Medical Leave"];
interface SpeechRecognitionResultItem {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  0: SpeechRecognitionResultItem;
  length: number;
  isFinal: boolean;
}

interface SpeechRecognitionEventLike {
  results: ArrayLike<SpeechRecognitionResultLike>;
  resultIndex: number;
}

interface SpeechRecognitionErrorLike {
  error: string;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

function subscribeSpeechAvailability() {
  return () => {};
}

function getSpeechAvailability() {
  if (typeof window === "undefined") return false;
  const recognitionWindow = window as SpeechRecognitionWindow;
  return Boolean(recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition);
}

function getServerSpeechAvailability() {
  return false;
}

const toolInfo: Record<FacultyToolKind, { title: string; subtitle: string }> = {
  voice: { title: "Voice Attendance Terminal", subtitle: "Parse natural-language roll calls into reviewable attendance entries." },
  grid: { title: "Demo Attendance Grid", subtitle: "Search, batch-select, and update the class register." },
  gradebook: { title: "Demo Gradebook", subtitle: "Edit assessment marks and preview normalized course totals." },
  heatmap: { title: "Curriculum Health Heatmap", subtitle: "Spot weak units and cohort-wide curriculum bottlenecks." },
  remedial: { title: "Remedial Group Builder", subtitle: "Group students by weak course signal and assign focused makeup work." },
  interventions: { title: "Intervention Tracker", subtitle: "Schedule support, record outcomes, and follow intervention status." },
};

const curriculum = [
  { unit: "Data Structures", topics: [{ name: "Arrays & lists", mastery: 72 }, { name: "Trees", mastery: 58 }, { name: "Graph traversal", mastery: 39 }, { name: "Dynamic programming", mastery: 46 }] },
  { unit: "Database Systems", topics: [{ name: "Relational model", mastery: 76 }, { name: "Normalization", mastery: 54 }, { name: "Transactions", mastery: 48 }, { name: "Query planning", mastery: 63 }] },
  { unit: "Operating Systems", topics: [{ name: "Processes", mastery: 78 }, { name: "Scheduling", mastery: 67 }, { name: "Memory management", mastery: 43 }, { name: "File systems", mastery: 72 }] },
  { unit: "Computer Networks", topics: [{ name: "Network layers", mastery: 80 }, { name: "Routing", mastery: 62 }, { name: "Congestion control", mastery: 49 }, { name: "Transport protocols", mastery: 71 }] },
];

function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  const colors = { neutral: "border-white/10 bg-white/[0.04] text-zinc-300", good: "border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100", warn: "border-amber-200/20 bg-amber-200/[0.07] text-amber-100", bad: "border-rose-200/20 bg-rose-200/[0.07] text-rose-100" };
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-medium ${colors[tone]}`}>{children}</span>;
}

export function FacultyTools({ tool }: { tool: FacultyToolKind }) {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const { session } = useDemoSession();
  const committedRows = demoState.committedVoiceRows;
  const attendance = demoState.attendanceByStudent;
  const grades = demoState.gradebook;
  const assignedGroups = demoState.remedialAssignments;
  const interventions = demoState.interventions;
  const roster = getDemoRoster(demoState);
  const [transcript, setTranscript] = useState("Roll 40 to 45 present except 42");
  const [stagedRows, setStagedRows] = useState<ParsedAttendanceRow[]>([]);
  const [lowConfidenceReviewed, setLowConfidenceReviewed] = useState(false);
  const [recording, setRecording] = useState(false);
  const speechAvailable = useSyncExternalStore(
    subscribeSpeechAvailability,
    getSpeechAvailability,
    getServerSpeechAvailability,
  );
  const speechRecognition = useRef<SpeechRecognitionLike | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(() => new Set());
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [attendanceQuery, setAttendanceQuery] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("All");
  const [attendanceSaved, setAttendanceSaved] = useState(false);
  const [normalization, setNormalization] = useState(0);
  const [gradeSaved, setGradeSaved] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newIntervention, setNewIntervention] = useState({ student: "", mentor: "Dr. Meera Shah", date: "2026-10-20", type: "Remedial session", notes: "" });
  const [notice, setNotice] = useState("");
  const info = toolInfo[tool];

  const notify = useCallback((message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  }, []);

  const updateAttendance = useCallback((update: (previous: Record<number, AttendanceStatus>) => Record<number, AttendanceStatus>) => {
    setDemoState((previous) => {
      const attendanceByStudent = update(previous.attendanceByStudent);
      const previousAttending = countsAsAttending(previous.attendanceByStudent[1]);
      const nextAttending = countsAsAttending(attendanceByStudent[1]);
      const attendanceChange = Number(nextAttending) - Number(previousAttending);
      return {
        ...previous,
        attendanceByStudent,
        attendanceSimulator: {
          ...previous.attendanceSimulator,
          classesAttended: Math.max(0, Math.min(
            previous.attendanceSimulator.totalClasses,
            previous.attendanceSimulator.classesAttended + attendanceChange,
          )),
        },
      };
    });
    setAttendanceSaved(false);
  }, [setDemoState]);

  const voiceResult = useMemo(() => parseVoiceCommand(transcript), [transcript]);
  const filteredAttendance = roster.filter((student) =>
    `${student.name} ${student.rollNo}`.toLowerCase().includes(attendanceQuery.toLowerCase())
    && (attendanceFilter === "All" || attendance[student.id] === attendanceFilter),
  );
  const attendancePercent = Math.round(roster.reduce((total, student) => total + student.attendance, 0) / roster.length);
  const reportRoster = roster.filter((student) => (
    session?.role === "HOD" ? student.department === HOD_DEPARTMENT
      : session?.role === "MENTOR" ? student.mentor === session.user.name
        : true
  ));
  const visibleReportRoster = reportRoster
    .filter((student) => attendanceFilter === "All" || attendance[student.id] === attendanceFilter)
    .filter((student) => `${student.name} ${student.rollNo}`.toLowerCase().includes(attendanceQuery.toLowerCase()));
  const statusCounts = attendanceStatuses.map((status) => [
    status,
    visibleReportRoster.filter((student) => (attendance[student.id] ?? "Absent") === status).length,
  ] as [string, number]);
  const report: ReportDocument = (() => {
    if (tool === "grid") return {
      type: session?.role === "MENTOR" ? "mentor-attendance" : "faculty-attendance",
      title: session?.role === "HOD" ? "HOD Department Attendance Report" : session?.role === "MENTOR" ? "Mentor Attendance Report" : "Faculty Attendance Report",
      period: demoState.term,
      filters: { Department: session?.role === "HOD" ? HOD_DEPARTMENT : "All", Status: attendanceFilter, Search: attendanceQuery || "All" },
      columns: ["Course", "Batch / Year", "Student", "Roll Number", "Attendance %", "Current Status", "Present", "Absent", "On Duty", "Medical Leave", "Total Classes"],
      rows: visibleReportRoster.map((student) => {
          const status = attendance[student.id] ?? "Absent";
          return [student.course, `Year ${student.year}`, student.name, student.rollNo, `${student.attendance}%`, status, Number(status === "Present"), Number(status === "Absent"), Number(status === "On Duty"), Number(status === "Medical Leave"), demoState.attendanceSimulator.totalClasses];
        }),
      summary: [
        ["Total Students", visibleReportRoster.length],
        ["Average Attendance", `${(visibleReportRoster.reduce((sum, student) => sum + student.attendance, 0) / Math.max(visibleReportRoster.length, 1)).toFixed(1)}%`],
        ["Below Attendance Threshold", visibleReportRoster.filter((student) => student.attendance < demoState.settings.attendanceMinimum).length],
        ...statusCounts,
      ],
    };
    if (tool === "gradebook") return {
      type: session?.role === "MENTOR" ? "mentor-academic" : "faculty-gradebook",
      title: session?.role === "MENTOR" ? "Mentor Academic Report" : "Faculty Gradebook Report",
      period: demoState.term,
      columns: ["Student", "Roll Number", "CIA", "Midterm", "Lab", "Assignment", "Total", "Percentage", "Normalized Score", "Risk Score", "Risk Level"],
      rows: reportRoster.map((student) => {
        const grade = grades[student.id];
        const total = grade.cia + grade.midterm + grade.lab + grade.assignment;
        return [student.name, student.rollNo, grade.cia, grade.midterm, grade.lab, grade.assignment, total.toFixed(1), `${student.assessmentAverage}%`, `${((grade.cia + grade.midterm) / 2).toFixed(1)}%`, student.risk.toFixed(1), student.status];
      }),
      summary: [
        ["Class Average", `${(reportRoster.reduce((sum, student) => sum + student.assessmentAverage, 0) / Math.max(reportRoster.length, 1)).toFixed(1)}%`],
        ["Highest Score", `${Math.max(...reportRoster.map((student) => student.assessmentAverage), 0)}%`],
        ["Lowest Score", `${reportRoster.length ? Math.min(...reportRoster.map((student) => student.assessmentAverage)) : 0}%`],
        ["At-Risk Students", reportRoster.filter((student) => student.status !== "Safe").length],
        ["Critical Students", reportRoster.filter((student) => student.status === "Critical").length],
      ],
    };
    if (tool === "heatmap" && session?.role === "MENTOR") return {
      type: "mentor-risk",
      title: "Mentor Risk Report",
      period: demoState.term,
      columns: ["Student", "Roll", "Risk Score", "Risk Level", "Risk Factors", "Recommended Action", "Recovery Status"],
      rows: reportRoster.map((student) => [student.name, student.rollNo, student.risk.toFixed(1), student.status, student.riskDrivers.join(", "), student.courseRisk.recommendations.join("; "), demoState.interventions.find((item) => item.student === student.name)?.status ?? "Not started"]),
    };
    if (tool === "heatmap") return {
      type: session?.role === "MENTOR" ? "mentor-risk" : "faculty-curriculum-health",
      title: session?.role === "MENTOR" ? "Mentor Risk Report" : "Curriculum Health Report",
      period: demoState.term,
      columns: ["Curriculum Unit", "Topic", "Mastery %", "Failure %", "Bottleneck"],
      rows: curriculum.flatMap((unit) => unit.topics.map((topic) => [unit.unit, topic.name, topic.mastery, 100 - topic.mastery, topic.mastery < 50 ? "Yes" : "No"])),
      summary: [["Cohort Students", reportRoster.length], ["Topics Above Failure Threshold", curriculum.flatMap((unit) => unit.topics).filter((topic) => 100 - topic.mastery > 50).length]],
    };
    if (tool === "remedial") return {
      type: session?.role === "MENTOR" ? "mentor-recovery" : "faculty-remedial-groups",
      title: session?.role === "MENTOR" ? "Mentor Recovery Report" : "Remedial Groups Report",
      period: demoState.term,
      columns: ["Student", "Roll", "Risk Level", "Weak Subject / Topic", "Recommended Recovery", "Remedial Group", "Intervention Status"],
      rows: reportRoster.filter((student) => student.status !== "Safe").map((student) => [
        student.name, student.rollNo, student.status, student.issue,
        student.courseRisk.recommendations.join("; "), assignedGroups[String(student.id)] ?? "Unassigned",
        demoState.interventions.find((item) => item.student === student.name)?.status ?? "Pending",
      ]),
      summary: [["Total Remedial Groups", new Set(Object.values(assignedGroups)).size], ["Students Assigned", Object.keys(assignedGroups).length], ["Critical Students", reportRoster.filter((student) => student.status === "Critical").length]],
    };
    if (tool === "interventions") return {
      type: session?.role === "MENTOR" ? "mentor-interventions" : "faculty-interventions",
      title: session?.role === "MENTOR" ? "Mentor Intervention Report" : "Faculty Intervention Report",
      period: demoState.term,
      columns: ["Student", "Risk Level", "Trigger", "Intervention", "Owner", "Status", "Created Date", "Last Updated"],
      rows: demoState.interventions.filter((item) => reportRoster.some((student) => student.name === item.student)).map((item) => {
        const student = reportRoster.find((entry) => entry.name === item.student);
        return [item.student, student?.status ?? "Unknown", student?.issue ?? "—", item.type, item.mentor, item.status, item.date, item.date];
      }),
      summary: [["Total Interventions", demoState.interventions.length], ["Active", demoState.interventions.filter((item) => item.status === "Scheduled").length], ["Completed", demoState.interventions.filter((item) => item.status === "Completed").length]],
    };
    return {
      type: session?.role === "MENTOR" ? "mentor-dashboard" : "faculty-dashboard",
      title: session?.role === "MENTOR" ? "Mentor Academic Summary" : "Faculty Academic Summary",
      period: demoState.term,
      columns: ["Student", "Roll", "Attendance", "Academic Performance", "Risk Score", "Risk Level", "Recovery / Intervention"],
      rows: reportRoster.map((student) => [student.name, student.rollNo, `${student.attendance}%`, `${student.assessmentAverage}%`, student.risk.toFixed(1), student.status, demoState.interventions.find((item) => item.student === student.name)?.status ?? "Not started"]),
      summary: [["Total Students", reportRoster.length], ["Average Attendance", `${(reportRoster.reduce((sum, student) => sum + student.attendance, 0) / Math.max(reportRoster.length, 1)).toFixed(1)}%`], ["Critical Students", reportRoster.filter((student) => student.status === "Critical").length], ["Active Interventions", demoState.interventions.filter((item) => item.status === "Scheduled").length]],
    };
  })();

  useEffect(() => {
    if (tool !== "grid") return;
    const keyHandler = (event: KeyboardEvent) => {
      if (!(event.target instanceof HTMLElement) || ["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      const keyToStatus: Record<string, AttendanceStatus> = { p: "Present", a: "Absent", o: "On Duty" };
      const nextStatus = keyToStatus[event.key.toLowerCase()];
      if (!nextStatus) return;
      const ids = selectedRows.size > 0 ? [...selectedRows] : activeRow === null ? [] : [activeRow];
      if (ids.length === 0) return;
      event.preventDefault();
      updateAttendance((previous) => Object.fromEntries(Object.entries(previous).map(([id, status]) => [Number(id), ids.includes(Number(id)) ? nextStatus : status])));
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  }, [activeRow, selectedRows, tool, updateAttendance]);

  useEffect(() => {
    if (tool !== "voice") return;
    const recognitionWindow = window as SpeechRecognitionWindow;
    const Recognition = recognitionWindow.SpeechRecognition ?? recognitionWindow.webkitSpeechRecognition;
    if (!Recognition) return;

    const instance = new Recognition();
    instance.continuous = false;
    instance.interimResults = false;
    instance.lang = "en-US";
    instance.onresult = (event) => {
      const result = event.results[event.results.length - 1];
      if (result?.[0]?.transcript) setTranscript(result[0].transcript);
    };
    instance.onerror = (event) => {
      setRecording(false);
      notify(`Speech recognition error: ${event.error}. You can enter the transcript manually.`);
    };
    instance.onend = () => setRecording(false);
    speechRecognition.current = instance;

    return () => {
      instance.onresult = null;
      instance.onerror = null;
      instance.onend = null;
      instance.abort();
      speechRecognition.current = null;
    };
  }, [notify, tool]);

  const updateGrade = (studentId: number, key: keyof GradeRecord, value: number) => {
    const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    setDemoState((previous) => ({
      ...previous,
      gradebook: {
        ...previous.gradebook,
        [studentId]: { ...previous.gradebook[studentId], [key]: normalizedValue },
      },
    }));
    setGradeSaved(false);
  };

  const createIntervention = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newIntervention.student.trim()) return;
    setDemoState((previous) => ({ ...previous, interventions: [{ ...newIntervention, id: Date.now(), status: "Scheduled" }, ...previous.interventions] }));
    setNewIntervention({ student: "", mentor: "Dr. Meera Shah", date: "2026-10-20", type: "Remedial session", notes: "" });
    setModalOpen(false);
    notify("Intervention added to the demo tracker.");
  };

  const updateInterventionStatus = (id: number, status: InterventionStatus) => {
    setDemoState((previous) => ({
      ...previous,
      interventions: previous.interventions.map((item) => item.id === id ? { ...item, status } : item),
    }));
    notify(`Intervention marked ${status.toLowerCase()}.`);
  };

  const content = () => {
    if (tool === "voice") {
      const confidenceTone = (confidence: number) => confidence < 0.85 ? "bad" : "good";
      const handleParse = () => {
        setStagedRows(voiceResult.rows);
        setLowConfidenceReviewed(false);
        if (voiceResult.error) notify(voiceResult.error);
        else if (voiceResult.type === "UNKNOWN") notify("No rows staged. Try one of the supported demo phrases.");
      };
      const runSample = (sample: string) => {
        setTranscript(sample);
        const result = parseVoiceCommand(sample);
        setStagedRows(result.rows);
        setLowConfidenceReviewed(false);
        if (result.error) notify(result.error);
      };
      const handleRecord = () => {
        const recognition = speechRecognition.current;
        if (!recognition) {
          notify("Speech recognition unavailable — Demo Transcript Mode. Enter a command below.");
          return;
        }
        if (recording) {
          recognition.stop();
          setRecording(false);
          return;
        }
        try {
          recognition.start();
          setRecording(true);
        } catch {
          setRecording(false);
          notify("Could not start speech recognition. Enter a command manually.");
        }
      };
      const commitRows = () => {
        if (stagedRows.some((row) => row.confidence < 0.85) && !lowConfidenceReviewed) {
          notify("Review and confirm the low-confidence entries before committing.");
          return;
        }
        const validRows = stagedRows.every((row) => {
          if (!Number.isInteger(row.roll) || row.roll < 1 || row.roll > facultyStudents.length) return false;
          if (row.status === "EXCLUDED") return true;
          return row.status !== "Scored"
            || (row.score !== null && row.scoreMaximum !== null && row.scoreMaximum > 0 && row.score >= 0 && row.score <= row.scoreMaximum);
        });
        if (!validRows) {
          notify("Some staged entries are invalid or do not match a roster roll number.");
          return;
        }
        setDemoState((previous) => {
          const attendanceByStudent = { ...previous.attendanceByStudent };
          const gradebook = { ...previous.gradebook };
          let classesAttended = previous.attendanceSimulator.classesAttended;
          for (const row of stagedRows) {
            if (row.status === "EXCLUDED") continue;
            if (row.status === "Scored") {
              const previousGrades = gradebook[row.roll] ?? { cia: 0, midterm: 0, lab: 0, assignment: 0 };
              gradebook[row.roll] = {
                ...previousGrades,
                cia: Number((((row.score ?? 0) / (row.scoreMaximum ?? 1)) * 100).toFixed(1)),
              };
              continue;
            }
            const currentStatus = attendanceByStudent[row.roll] ?? "Absent";
            const nextStatus: AttendanceStatus = row.status;
            const attendanceChange = Number(countsAsAttending(nextStatus)) - Number(countsAsAttending(currentStatus));
            attendanceByStudent[row.roll] = nextStatus;
            if (row.roll === 1) {
              classesAttended = Math.max(0, Math.min(
                previous.attendanceSimulator.totalClasses,
                classesAttended + attendanceChange,
              ));
            }
          }
          return {
            ...previous,
            attendanceByStudent,
            gradebook,
            attendanceSimulator: { ...previous.attendanceSimulator, classesAttended },
            committedVoiceRows: [...previous.committedVoiceRows, ...stagedRows.filter((row) => row.status !== "EXCLUDED")],
          };
        });
        const committedCount = stagedRows.filter((row) => row.status !== "EXCLUDED").length;
        if (committedCount === 0) {
          notify("No entries to commit; all staged rolls are excluded.");
        } else {
          notify(`${committedCount} entries committed to the demo register.`);
        }
        setStagedRows([]);
        setLowConfidenceReviewed(false);
      };
      return <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <section className={panel}><div className="flex items-start justify-between"><div><h2 className="font-semibold text-white">Voice capture</h2><p className="mt-1 text-xs text-zinc-500">Use speech recognition when available or enter a transcript manually.</p></div><Pill tone={speechAvailable ? "good" : "warn"}>{speechAvailable ? "MIC READY" : "DEMO INPUT"}</Pill></div>{!speechAvailable ? <p role="status" className="mt-4 rounded-xl border border-amber-200/20 bg-amber-200/[0.06] p-3 text-xs text-amber-100">Speech recognition is unavailable in this browser. You can enter a demo transcript manually.</p> : null}<button type="button" onClick={handleRecord} aria-pressed={recording} disabled={!speechAvailable} className={`mt-5 flex w-full items-center justify-center gap-3 rounded-xl border px-4 py-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${recording ? "animate-pulse border-rose-200/30 bg-rose-200/[0.09] text-rose-100" : "border-emerald-200/20 bg-emerald-200/[0.06] text-emerald-100 hover:bg-emerald-200/[0.11]"}`}><Mic className="h-5 w-5" />{recording ? "Stop recording" : speechAvailable ? "Start recording" : "Microphone unavailable"}</button><label className="mt-5 block text-xs font-medium text-zinc-300" htmlFor="voice-transcript">Transcript input</label><textarea id="voice-transcript" value={transcript} onChange={(event) => setTranscript(event.target.value)} rows={4} className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-[#0b1213] p-3 text-sm text-white outline-none focus-visible:border-emerald-200/40" placeholder="Try: Roll 40 to 45 present except 42" /><div className="mt-3 flex flex-wrap gap-2">{["Roll 40 to 45 present except 42", "Roll 18 absent", "Roll 25 score 8 out of 10"].map((sample) => <button type="button" key={sample} onClick={() => runSample(sample)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-zinc-400 hover:text-white">{sample}</button>)}</div><div className="mt-5 flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.025] p-3"><div><p className="text-xs text-zinc-500">Parsed command · {voiceResult.type}</p><p className="mt-1 text-sm text-white">{voiceResult.summary}</p><p className="mt-1 text-[10px] text-zinc-500">{voiceResult.originalTranscript || "No transcript entered."}</p>{voiceResult.error ? <p role="alert" className="mt-1 text-xs text-rose-200">{voiceResult.error}</p> : null}</div><Pill tone={confidenceTone(voiceResult.confidence)}>{Math.round(voiceResult.confidence * 100)}% confidence</Pill></div><button type="button" onClick={handleParse} className="mt-4 w-full rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712] hover:bg-emerald-100">Parse and stage</button></section>
        <section className={panel}><div className="flex items-center justify-between"><div><h2 className="font-semibold text-white">Staging table</h2><p className="mt-1 text-xs text-zinc-500">Review parsed rows before committing.</p></div><Pill>{stagedRows.length} staged</Pill></div><div className="mt-4 overflow-x-auto"><table className="min-w-[520px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Roll number</th><th className="py-3">Action</th><th className="py-3">Status</th><th className="py-3">Score</th><th className="py-3">Confidence</th></tr></thead><tbody>{stagedRows.map((row) => <tr key={`${row.roll}-${row.status}`} className={`border-b text-zinc-300 ${row.confidence < 0.85 ? "border-rose-300/40 bg-rose-300/[0.08]" : "border-white/[0.06]"}`}><td className="py-3 font-mono text-white">{row.roll}</td><td className="py-3">{row.status === "Scored" ? "Grade" : "Attendance"}</td><td className="py-3">{row.status}</td><td className="py-3">{row.score === null ? "—" : `${row.score}/${row.scoreMaximum}`}</td><td className="py-3"><Pill tone={confidenceTone(row.confidence)}>{Math.round(row.confidence * 100)}%</Pill></td></tr>)}</tbody></table>{stagedRows.length === 0 ? <p className="py-9 text-center text-sm text-zinc-500">Parse a demo command to stage entries.</p> : null}</div>{stagedRows.some((row) => row.confidence < 0.85) ? <label className="mt-3 flex items-center gap-2 rounded-lg border border-rose-300/25 bg-rose-300/[0.06] p-3 text-xs text-rose-100"><input type="checkbox" checked={lowConfidenceReviewed} onChange={(event) => setLowConfidenceReviewed(event.target.checked)} className="accent-rose-300" />I reviewed the low-confidence entries and approve them.</label> : null}<div className="mt-4 flex gap-2"><button type="button" onClick={commitRows} disabled={stagedRows.length === 0 || (stagedRows.some((row) => row.confidence < 0.85) && !lowConfidenceReviewed)} className="flex-1 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712] disabled:cursor-not-allowed disabled:opacity-40">Commit entries</button><button type="button" onClick={() => { setStagedRows([]); setLowConfidenceReviewed(false); }} disabled={stagedRows.length === 0} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-300 disabled:opacity-40">Clear</button></div><div className="mt-5 rounded-xl border border-white/10 bg-white/[0.025] p-3"><p className="text-xs text-zinc-500">Committed in this session</p><p className="mt-1 text-xl font-semibold text-white">{committedRows.length} <span className="text-xs font-normal text-zinc-500">entries</span></p></div></section>
      </div>;
    }

    if (tool === "grid") {
      const toggleSelected = (id: number) => setSelectedRows((previous) => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; });
      const selectVisible = () => setSelectedRows((previous) => previous.size === filteredAttendance.length ? new Set() : new Set(filteredAttendance.map((student) => student.id)));
      const batchSet = (status: AttendanceStatus) => {
        if (selectedRows.size === 0) return;
        updateAttendance((previous) => Object.fromEntries(Object.entries(previous).map(([id, value]) => [Number(id), selectedRows.has(Number(id)) ? status : value])));
      };
      const saveAttendance = () => { setAttendanceSaved(true); notify("Attendance changes saved to the local demo register."); };
      return <>
        <div className="grid gap-3 sm:grid-cols-3"><div className={panel}><p className="text-xs text-zinc-500">Roster size</p><p className="mt-2 text-2xl font-semibold text-white">{roster.length}</p></div><div className={panel}><p className="text-xs text-zinc-500">Attendance rate</p><p className="mt-2 text-2xl font-semibold text-white">{attendancePercent}%</p></div><div className={panel}><p className="text-xs text-zinc-500">Selected</p><p className="mt-2 text-2xl font-semibold text-white">{selectedRows.size}</p></div></div>
        <section className={panel}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Data Structures · Roll register</h2><p className="mt-1 text-xs text-zinc-500">Keyboard shortcuts: P present · A absent · O on duty</p></div><button type="button" onClick={saveAttendance} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]"><Save className="h-4 w-4" />{attendanceSaved ? "Saved" : "Save changes"}</button></div><div className="mt-4 flex flex-wrap gap-2"><label className="relative min-w-52 flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" /><input value={attendanceQuery} onChange={(event) => setAttendanceQuery(event.target.value)} placeholder="Search student or roll" className="w-full rounded-xl border border-white/10 bg-[#0b1213] py-2.5 pl-9 pr-3 text-xs text-white outline-none" /></label><select value={attendanceFilter} onChange={(event) => setAttendanceFilter(event.target.value)} aria-label="Filter attendance status" className="rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-300"><option>All</option>{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select><button type="button" onClick={selectVisible} className="rounded-xl border border-white/10 px-3 py-2.5 text-xs text-zinc-300">{selectedRows.size === filteredAttendance.length ? "Clear selection" : "Select visible"}</button></div><div className="mt-3 flex flex-wrap gap-2">{attendanceStatuses.map((status) => <button key={status} type="button" disabled={selectedRows.size === 0} onClick={() => batchSet(status)} className="rounded-lg border border-white/10 px-2.5 py-1.5 text-[10px] text-zinc-300 disabled:opacity-40">Set selected: {status}</button>)}</div><div className="mt-4 overflow-x-auto"><table className="min-w-[680px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="w-10 py-3"><input type="checkbox" aria-label="Select visible students" checked={filteredAttendance.length > 0 && filteredAttendance.every((student) => selectedRows.has(student.id))} onChange={selectVisible} /></th><th className="py-3">Student</th><th className="py-3">Roll</th><th className="py-3">Attendance</th><th className="py-3">Status</th></tr></thead><tbody>{filteredAttendance.map((student) => <tr key={student.id} onFocusCapture={() => setActiveRow(student.id)} className="border-b border-white/[0.06] text-zinc-300"><td className="py-2.5"><input type="checkbox" aria-label={`Select ${student.name}`} checked={selectedRows.has(student.id)} onChange={() => toggleSelected(student.id)} /></td><td className="py-2.5 font-medium text-white">{student.name}</td><td className="py-2.5 font-mono text-zinc-500">{student.rollNo}</td><td className="py-2.5">{student.attendance}%</td><td className="py-2.5"><select aria-label={`${student.name} attendance status`} value={attendance[student.id]} onChange={(event) => updateAttendance((previous) => ({ ...previous, [student.id]: event.target.value as AttendanceStatus }))} className="rounded-lg border border-white/10 bg-[#0b1213] px-2 py-1.5 text-xs text-zinc-200">{attendanceStatuses.map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table>{filteredAttendance.length === 0 ? <p className="py-7 text-center text-sm text-zinc-500">No students match your search.</p> : null}</div></section>
      </>;
    }

    if (tool === "gradebook") {
      const students = roster.slice(0, 16);
      const scoreFor = (record: GradeRecord) => record.cia * 0.3 + record.midterm * 0.3 + record.lab * 0.25 + record.assignment * 0.15;
      return <>
        <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-zinc-400">Database Systems · 16 of {roster.length} students</p><button type="button" onClick={() => { setGradeSaved(true); notify("Gradebook saved to the local demo register."); }} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]"><Save className="h-4 w-4" />{gradeSaved ? "Saved" : "Save gradebook"}</button></div>
        <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Assessment editor</h2><p className="mt-1 text-xs text-zinc-500">Each component is entered as a percentage of its maximum marks.</p></div><label className="flex items-center gap-3 text-xs text-zinc-400">Normalization preview <input type="range" min={-10} max={10} value={normalization} onChange={(event) => { setNormalization(Number(event.target.value)); setGradeSaved(false); }} /><span className="w-10 text-right text-white">{normalization > 0 ? "+" : ""}{normalization}%</span></label></div><div className="overflow-x-auto"><table className="min-w-[940px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3 pr-3">Student</th><th className="py-3 px-2">CIA /30%</th><th className="py-3 px-2">Midterm /30%</th><th className="py-3 px-2">Lab /25%</th><th className="py-3 px-2">Assignment /15%</th><th className="py-3 px-2">Total</th><th className="py-3 px-2">Normalized</th><th className="py-3">Risk</th></tr></thead><tbody>{students.map((student) => { const record = grades[student.id]; const total = scoreFor(record); const adjusted = Math.max(0, Math.min(100, total + normalization)); const risk = calculateRisk({ attendance: student.attendance, assessmentAverage: total, academicVelocity: student.velocity, assignmentPerformance: record.assignment, labCompletion: record.lab }); const inputFor = (key: keyof GradeRecord, label: string) => <input aria-label={`${student.name} ${label} score`} type="number" min={0} max={100} value={record[key]} onChange={(event) => updateGrade(student.id, key, Number(event.target.value))} className="w-16 rounded-lg border border-white/10 bg-[#0b1213] px-2 py-1.5 text-center text-xs text-white" />; return <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-2.5 pr-3"><span className="font-medium text-white">{student.name}</span><span className="ml-2 font-mono text-zinc-600">{student.rollNo}</span></td><td className="px-2">{inputFor("cia", "CIA")}</td><td className="px-2">{inputFor("midterm", "midterm")}</td><td className="px-2">{inputFor("lab", "lab")}</td><td className="px-2">{inputFor("assignment", "assignment")}</td><td className="px-2 font-semibold text-white">{total.toFixed(1)}%</td><td className="px-2 text-emerald-100">{adjusted.toFixed(1)}%</td><td><Pill tone={risk.category === "CRITICAL" ? "bad" : risk.category === "MODERATE" ? "warn" : "good"}>{risk.category}</Pill></td></tr>; })}</tbody></table></div><p className="mt-4 text-[11px] text-zinc-500">Normalization preview is illustrative and does not alter source marks until saved.</p></section>
      </>;
    }

    if (tool === "heatmap") {
      const bottleneckCount = curriculum.flatMap((unit) => unit.topics).filter((topic) => 100 - topic.mastery > 40).length;
      return <>
        {bottleneckCount > 0 ? <div role="status" className="flex items-center gap-2 rounded-xl border border-rose-200/20 bg-rose-200/[0.06] p-3 text-sm text-rose-100"><CircleAlert className="h-4 w-4" />Curriculum Bottleneck Detected <span className="text-xs text-rose-100/70">{bottleneckCount} topics exceed 40% failure</span></div> : null}
        <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Unit mastery and failure risk</h2><p className="mt-1 text-xs text-zinc-500">Cell value is mastery · failure is 100 minus mastery.</p></div><div className="flex gap-3 text-[10px] text-zinc-500"><span>Mastery %</span><span>Failure &gt; 40% highlighted</span></div></div><div className="overflow-x-auto"><table className="min-w-[780px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="w-44 py-3">Curriculum unit</th>{curriculum[0].topics.map((topic) => <th key={topic.name} className="px-2 py-3 text-center">{topic.name}</th>)}</tr></thead><tbody>{curriculum.map((unit) => <tr key={unit.unit} className="border-b border-white/[0.06]"><th className="py-4 pr-3 text-left font-medium text-white">{unit.unit}</th>{unit.topics.map((topic) => { const failure = 100 - topic.mastery; const bottleneck = failure > 40; return <td key={topic.name} className="px-2 py-2"><div className={`rounded-lg border p-3 text-center ${bottleneck ? "border-rose-200/20 bg-rose-200/[0.08] text-rose-100" : "border-emerald-200/10 bg-emerald-200/[0.04] text-emerald-100"}`}><span className="block font-semibold">{topic.mastery}%</span><span className="mt-1 block text-[9px] opacity-70">{failure}% fail</span></div></td>; })}</tr>)}</tbody></table></div></section>
      </>;
    }

    if (tool === "remedial") {
      const groups = [
        { id: "A", title: "Data Structures", matches: roster.filter((student) => student.course === "Data Structures"), action: "Graph practice clinic · 2 sessions" },
        { id: "B", title: "DBMS", matches: roster.filter((student) => student.course === "DBMS" || student.course === "Database Systems"), action: "SQL and normalization workshop" },
        { id: "C", title: "Attendance", matches: roster.filter((student) => student.attendance < demoState.settings.attendanceMinimum), action: "Attendance recovery check-in" },
      ];
      return <>
        <div className="grid gap-3 md:grid-cols-3">{groups.map((group) => { const average = group.matches.reduce((total, student) => total + student.assessmentAverage, 0) / Math.max(group.matches.length, 1); return <article key={group.id} className={panel}><div className="flex items-center justify-between"><Pill>Group {group.id}</Pill><Users className="h-4 w-4 text-emerald-200" /></div><h2 className="mt-4 text-lg font-semibold text-white">{group.title}</h2><div className="mt-4 grid grid-cols-2 gap-3"><div><p className="text-xs text-zinc-500">Students</p><p className="mt-1 text-xl font-semibold text-white">{group.matches.length}</p></div><div><p className="text-xs text-zinc-500">Average score</p><p className="mt-1 text-xl font-semibold text-white">{average.toFixed(1)}%</p></div></div><p className="mt-4 text-xs text-zinc-400">Suggested intervention</p><p className="mt-1 text-sm text-zinc-200">{group.action}</p><label className="mt-5 block text-xs text-zinc-400">Makeup assignment<input value={assignedGroups[group.id] ?? ""} onChange={(event) => setDemoState((previous) => ({ ...previous, remedialAssignments: { ...previous.remedialAssignments, [group.id]: event.target.value } }))} placeholder={`Create ${group.title} task`} className="mt-2 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-white" /></label><button type="button" onClick={() => { if (!(assignedGroups[group.id] ?? "").trim()) { notify("Add a makeup assignment title first."); return; } notify(`Assignment assigned to Group ${group.id} demo roster.`); }} className="mt-3 w-full rounded-xl border border-emerald-200/15 bg-emerald-200/[0.06] px-3 py-2.5 text-xs font-medium text-emerald-100 hover:bg-emerald-200/[0.1]">Assign makeup work</button></article>; })}</div>
      </>;
    }

    const statusTone = (status: InterventionStatus) => status === "Completed" ? "good" : status === "No-show" ? "bad" : status === "Cancelled" ? "neutral" : "warn";
    return <>
      <section className={panel}><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Intervention schedule</h2><p className="mt-1 text-xs text-zinc-500">Demo records are stored in page state for this session.</p></div><button type="button" onClick={() => setModalOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]"><Plus className="h-4 w-4" />Create intervention</button></div><div className="overflow-x-auto"><table className="min-w-[880px] w-full text-left text-xs"><thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3 pr-4">Student</th><th className="py-3 pr-4">Intervention type</th><th className="py-3 pr-4">Mentor</th><th className="py-3 pr-4">Date</th><th className="py-3 pr-4">Status</th><th className="py-3">Update</th></tr></thead><tbody>{interventions.map((item) => <tr key={item.id} className="border-b border-white/[0.06] text-zinc-300"><td className="py-3 pr-4"><span className="font-medium text-white">{item.student}</span><span className="mt-1 block text-zinc-500">{item.notes}</span></td><td className="py-3 pr-4">{item.type}</td><td className="py-3 pr-4">{item.mentor}</td><td className="py-3 pr-4">{item.date}</td><td className="py-3 pr-4"><Pill tone={statusTone(item.status)}>{item.status}</Pill></td><td className="py-3"><select aria-label={`Update ${item.student} intervention`} value={item.status} onChange={(event) => updateInterventionStatus(item.id, event.target.value as InterventionStatus)} className="rounded-lg border border-white/10 bg-[#0b1213] px-2 py-1.5 text-xs text-zinc-300">{(["Scheduled", "Completed", "Cancelled", "No-show"] as InterventionStatus[]).map((status) => <option key={status}>{status}</option>)}</select></td></tr>)}</tbody></table></div></section>
      {modalOpen ? <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"><section role="dialog" aria-modal="true" aria-labelledby="new-intervention-title" className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#111a1b] p-5 shadow-2xl"><div className="flex items-center justify-between"><div><p className="text-[10px] uppercase text-emerald-200">Demo record</p><h2 id="new-intervention-title" className="mt-1 text-lg font-semibold text-white">Create intervention</h2></div><button type="button" aria-label="Close create intervention" onClick={() => setModalOpen(false)} className="rounded-lg border border-white/10 p-2 text-zinc-300"><X className="h-4 w-4" /></button></div><form onSubmit={createIntervention} className="mt-5 space-y-3"><label className="block text-xs text-zinc-400">Student name<input required value={newIntervention.student} onChange={(event) => setNewIntervention((previous) => ({ ...previous, student: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs text-zinc-400">Mentor<input required value={newIntervention.mentor} onChange={(event) => setNewIntervention((previous) => ({ ...previous, mentor: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><label className="block text-xs text-zinc-400">Date<input required type="date" value={newIntervention.date} onChange={(event) => setNewIntervention((previous) => ({ ...previous, date: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label></div><label className="block text-xs text-zinc-400">Intervention type<select value={newIntervention.type} onChange={(event) => setNewIntervention((previous) => ({ ...previous, type: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white"><option>Remedial session</option><option>Mentor check-in</option><option>Parent meeting</option><option>Academic review</option></select></label><label className="block text-xs text-zinc-400">Notes<textarea value={newIntervention.notes} onChange={(event) => setNewIntervention((previous) => ({ ...previous, notes: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-lg border border-white/10 bg-[#0b1213] px-3 py-2.5 text-sm text-white" /></label><button type="submit" className="w-full rounded-xl bg-emerald-200 px-4 py-2.5 text-sm font-semibold text-[#0b1712]">Add scheduled intervention</button></form></section></div> : null}
    </>;
  };

  return <div><header className="border-b border-white/10 bg-[#0a1112]/90 px-4 py-4 backdrop-blur-xl sm:px-6"><div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase text-emerald-200/80">Faculty workspace <span className="px-1.5 text-zinc-600">/</span> Demo mode</p><h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{info.title}</h1><p className="mt-1 text-xs text-zinc-400">{info.subtitle}</p></div><div className="flex items-center gap-3"><ReportExportButton report={report} /><DemoControls /></div></div></header><main className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6">{tool === "grid" ? <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-zinc-500"><Keyboard className="h-3.5 w-3.5" />Select a row or batch, then press P, A, or O.</div> : null}{tool === "gradebook" ? <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-zinc-500"><FileSpreadsheet className="h-3.5 w-3.5" />Normalized preview is not written back to original assessment values.</div> : null}{content()}</main>{notice ? <div role="status" aria-live="polite" className="fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl border border-emerald-200/20 bg-[#102019] px-4 py-3 text-sm text-emerald-100 shadow-xl"><CheckCircle2 className="h-4 w-4" />{notice}</div> : null}</div>;
}
