"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";
import { DemoControls } from "@/components/layout/DemoControls";
import { InterventionModal } from "@/components/faculty/InterventionModal";
import { RiskHeatmap } from "@/components/faculty/RiskHeatmap";
import { StudentRiskTable } from "@/components/faculty/StudentRiskTable";
import { facultyStudents, riskHeatmap } from "@/lib/demo-data";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getDemoRoster } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";
import { useDemoSession } from "@/components/auth/useDemoSession";
import { ReportExportButton } from "@/components/reports/ReportExportButton";

export function FacultyDashboardPage({ workspace = "Faculty" }: { workspace?: "Faculty" | "Mentor" }) {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const { session } = useDemoSession();
  const facultyRoster = getDemoRoster(demoState);
  const reportRoster = workspace === "Mentor"
    ? facultyRoster.filter((student) => student.mentor === session?.user.name)
    : facultyRoster;
  const [selectedStudent, setSelectedStudent] = useState<(typeof facultyStudents)[number] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const criticalCount = facultyRoster.filter((student) => student.status === "Critical").length;
  const moderateCount = facultyRoster.filter((student) => student.status === "Moderate").length;
  const safeCount = facultyRoster.filter((student) => student.status === "Safe").length;
  const attendanceConcernCount = facultyRoster.filter((student) => student.attendance < demoState.settings.attendanceMinimum).length;
  const debarmentRate = (attendanceConcernCount / facultyRoster.length) * 100;
  const recoveryRate = demoState.interventions.length === 0 ? 0 : Math.round((demoState.interventions.filter((intervention) => intervention.status === "Completed").length / demoState.interventions.length) * 100);
  const courseHealth = facultyRoster.reduce((total, student) => total + student.assessmentAverage, 0) / Math.max(facultyRoster.length, 1);
  const interventionCount = facultyRoster.filter((student) => student.status !== "Safe").length;

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 2200);
  };

  return (
    <div className="min-h-screen text-white">
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0a1112]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-3 rounded-lg">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-300/10 text-emerald-200">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase text-emerald-200/80">Lumina AI <span className="px-1.5 text-zinc-600">/</span> {workspace} workspace</p>
              <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">{workspace === "Mentor" ? "Mentor cockpit" : "Academic cockpit"}</h1>
            </div>
          </Link>
          <div className="flex items-center gap-2 sm:gap-3">
            {session?.role === "FACULTY" ? (
              <Link href="/student/dashboard" className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2.5 text-xs font-medium text-zinc-300 transition hover:border-emerald-200/30 hover:text-white sm:px-4 sm:text-sm">
                Student view
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
            {workspace === "Mentor" && session?.role === "MENTOR" ? <ReportExportButton report={{
              type: "mentor-dashboard",
              title: "Mentor Academic & Intervention Report",
              period: demoState.term,
              reportSheetName: "Assigned Students",
              summarySheetName: "Mentor Summary",
              columns: ["Student", "Roll Number", "Attendance %", "Academic Performance %", "Risk Score", "Risk Level", "Recovery Progress", "Intervention Status", "Mentor Action", "Last Updated"],
              rows: reportRoster.map((student) => {
                const intervention = demoState.interventions.find((item) => item.student === student.name);
                const studentTasks = student.id === 1 ? demoState.recoveryTasks : [];
                const completedCount = student.id === 1 ? demoState.completedRecoveryTaskIds.length : 0;
                const recoveryProgress = studentTasks.length ? `${Math.round(completedCount / studentTasks.length * 100)}%` : "Not tracked";
                return [student.name, student.rollNo, `${student.attendance}%`, `${student.assessmentAverage}%`, student.risk, student.status, recoveryProgress, intervention?.status ?? "Not started", intervention?.notes ?? student.courseRisk.recommendations.join("; "), intervention?.date ?? "—"];
              }),
              summary: [
                ["Mentor Name", session.user.name],
                ["Assigned Students", reportRoster.length],
                ["Average Attendance", `${(reportRoster.reduce((sum, student) => sum + student.attendance, 0) / Math.max(reportRoster.length, 1)).toFixed(1)}%`],
                ["At-Risk Students", reportRoster.filter((student) => student.status !== "Safe").length],
                ["Critical Students", reportRoster.filter((student) => student.status === "Critical").length],
                ["Recovery Progress", `${reportRoster.length ? Math.round(reportRoster.filter((student) => demoState.interventions.some((item) => item.student === student.name && item.status === "Completed")).length / reportRoster.length * 100) : 0}%`],
                ["Active Interventions", demoState.interventions.filter((item) => item.status === "Scheduled" && reportRoster.some((student) => student.name === item.student)).length],
              ],
              workbookSheets: [
                {
                  name: "Risk & Recovery",
                  columns: ["Student", "Roll Number", "Risk Score", "Risk Level", "Risk Factors", "Recovery Progress", "Recommended Action"],
                  rows: reportRoster.map((student) => [student.name, student.rollNo, student.risk, student.status, student.riskDrivers.join(", "), student.id === 1 && demoState.recoveryTasks.length ? `${Math.round(demoState.completedRecoveryTaskIds.length / demoState.recoveryTasks.length * 100)}%` : "Not tracked", student.courseRisk.recommendations.join("; ")]),
                },
                {
                  name: "Interventions",
                  columns: ["Student", "Trigger", "Intervention", "Owner", "Status", "Last Updated"],
                  rows: demoState.interventions.filter((item) => reportRoster.some((student) => student.name === item.student)).map((item) => [item.student, reportRoster.find((student) => student.name === item.student)?.issue ?? "—", item.type, item.mentor, item.status, item.date]),
                },
              ],
            }} /> : <ReportExportButton report={{
              type: "faculty-dashboard",
              title: "Faculty Academic Report",
              period: demoState.term,
              reportSheetName: "Attendance",
              summarySheetName: "Faculty Summary",
              columns: ["Student", "Roll Number", "Course", "Attendance %", "Current Status", "Academic Performance %", "Risk Score", "Risk Level", "Intervention Status"],
              rows: facultyRoster.map((student) => [student.name, student.rollNo, student.course, `${student.attendance}%`, demoState.attendanceByStudent[student.id] ?? "—", `${student.assessmentAverage}%`, student.risk, student.status, demoState.interventions.find((item) => item.student === student.name)?.status ?? "Not started"]),
              summary: [["Faculty Name", session?.user.name ?? "Faculty"], ["Course", "All assigned courses"], ["Total Students", facultyRoster.length], ["Average Attendance", `${(facultyRoster.reduce((sum, student) => sum + student.attendance, 0) / Math.max(facultyRoster.length, 1)).toFixed(1)}%`], ["Average Academic Performance", `${courseHealth.toFixed(1)}%`], ["Safe Students", safeCount], ["Moderate Students", moderateCount], ["Critical Students", criticalCount], ["Active Interventions", demoState.interventions.filter((item) => item.status === "Scheduled").length]],
              workbookSheets: [
                {
                  name: "Grade Academic",
                  columns: ["Student", "Roll Number", "Course", "CIA", "Midterm", "Lab", "Assignment", "Academic Performance %"],
                  rows: facultyRoster.map((student) => {
                    const grade = demoState.gradebook[student.id];
                    return [student.name, student.rollNo, student.course, grade.cia, grade.midterm, grade.lab, grade.assignment, `${student.assessmentAverage}%`];
                  }),
                },
                {
                  name: "Risk",
                  columns: ["Student", "Roll Number", "Course", "Risk Score", "Risk Level", "Risk Factors", "Recommended Action"],
                  rows: facultyRoster.map((student) => [student.name, student.rollNo, student.course, student.risk, student.status, student.riskDrivers.join(", "), student.courseRisk.recommendations.join("; ")]),
                },
              ],
            }} />}
            <DemoControls />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] space-y-6 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {[
            { label: "Students monitored", value: String(facultyRoster.length) },
            { label: "Critical risk", value: String(criticalCount) },
            { label: "Moderate risk", value: String(moderateCount) },
            { label: "Safe students", value: String(safeCount) },
            { label: "Requiring intervention", value: String(interventionCount) },
            { label: "Projected debarment", value: `${debarmentRate.toFixed(1)}%` },
            { label: "Attendance compliance", value: `${(100 - debarmentRate).toFixed(1)}%` },
            { label: "Course health", value: `${courseHealth.toFixed(1)}%` },
            { label: "Recovery rate", value: `${recoveryRate}%` },
          ].map((item, index) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              className="rounded-3xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
            >
              <p className="text-sm text-zinc-400">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-white">{item.value}</p>
            </motion.div>
          ))}
        </div>

        <StudentRiskTable
          students={facultyRoster}
          onIntervene={(student) => setSelectedStudent(student)}
        />

        <RiskHeatmap data={riskHeatmap} />
      </main>

      <InterventionModal
        open={Boolean(selectedStudent)}
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
        onCreate={() => {
          if (!selectedStudent) return;
          setDemoState((previous) => ({
            ...previous,
            interventions: [{
              id: Date.now(),
              student: selectedStudent.name,
              mentor: selectedStudent.mentor,
              date: new Date().toISOString().slice(0, 10),
              notes: `Review ${selectedStudent.issue.toLowerCase()} and agree on a support plan.`,
              type: "Remedial session",
              status: "Scheduled",
            }, ...previous.interventions],
          }));
          showToast("Academic intervention saved to the demo tracker.");
        }}
      />

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] flex items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 shadow-lg shadow-emerald-950/30">
          <CheckCircle2 className="h-4 w-4" />
          {toast}
        </div>
      ) : null}
    </div>
  );
}
