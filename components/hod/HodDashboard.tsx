"use client";

import { useMemo } from "react";
import { DemoControls } from "@/components/layout/DemoControls";
import { getEscalationCandidates } from "@/lib/admin-analytics";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getDemoRoster } from "@/lib/demo-model";
import { HOD_DEPARTMENT } from "@/lib/hod-data";
import { useDemoState } from "@/lib/use-demo-state";
import { ReportExportButton } from "@/components/reports/ReportExportButton";
import { calculateAttainment } from "@/lib/accreditation-engine";
import { courses } from "@/lib/demo-data";
import type { ReportDocument } from "@/lib/reports/types";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5";

function Metric({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      {detail ? <p className="mt-1 text-xs text-zinc-500">{detail}</p> : null}
    </div>
  );
}

export function HodDashboard() {
  const [state] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const department = HOD_DEPARTMENT;
  const departmentRoster = useMemo(
    () => getDemoRoster(state).filter((student) => student.department === department),
    [department, state],
  );
  const escalations = getEscalationCandidates(departmentRoster, state)
    .filter((item) => item.status !== "Closed");
  const interventions = state.interventions.filter((item) => (
    departmentRoster.some((student) => student.name === item.student) && item.status !== "Cancelled"
  ));
  const activeInterventions = interventions.filter((item) => item.status === "Scheduled").length;
  const riskCount = departmentRoster.filter((student) => student.status !== "Safe").length;
  const averageAttendance = departmentRoster.length
    ? departmentRoster.reduce((total, student) => total + student.attendance, 0) / departmentRoster.length
    : 0;
  const averageAssessment = departmentRoster.length
    ? departmentRoster.reduce((total, student) => total + student.assessmentAverage, 0) / departmentRoster.length
    : 0;
  const courseSummary = useMemo(() => {
    const names = [...new Set(departmentRoster.map((student) => student.course))].sort();
    return names.map((course) => {
      const students = departmentRoster.filter((student) => student.course === course);
      const average = (selector: (student: (typeof students)[number]) => number) => (
        students.length ? students.reduce((total, student) => total + selector(student), 0) / students.length : 0
      );
      return {
        course,
        students: students.length,
        attendance: average((student) => student.attendance),
        assessment: average((student) => student.assessmentAverage),
        atRisk: students.filter((student) => student.status !== "Safe").length,
        mentors: [...new Set(students.map((student) => student.mentor))].join(", "),
      };
    });
  }, [departmentRoster]);
  const riskReport: ReportDocument = {
    type: "hod-risk",
    title: "HOD Department Risk Report",
    period: state.term,
    filters: { Department: department },
    columns: ["Student", "Course", "Faculty / Mentor", "Attendance", "Academic Score", "Risk Score", "Risk Level", "Risk Factors"],
    rows: departmentRoster.map((student) => [student.name, student.course, student.mentor, `${student.attendance}%`, `${student.assessmentAverage}%`, student.risk.toFixed(1), student.status, student.riskDrivers.join(", ")]),
  };
  const accreditationReport: ReportDocument = {
    type: "hod-accreditation",
    title: "HOD Accreditation Report",
    period: state.term,
    filters: { Department: department, Cutoff: "50%" },
    columns: ["Metric", "Department", "Numerator", "Denominator", "Percentage", "Reporting Period"],
    rows: courses.map((course) => {
      const scores = departmentRoster.map((student) => student.subjectMarks[course.name] ?? student.assessmentAverage);
      const result = calculateAttainment([{ code: course.name, title: course.name, scores, targetCutoff: 50 }])[0];
      const numerator = scores.filter((score) => score >= 50).length;
      return [result.title, department, numerator, result.studentsAssessed, `${result.attainment}%`, state.term];
    }),
    summary: [["Department", department], ["Reporting Period", state.term]],
  };
  const interventionReport: ReportDocument = {
    type: "hod-interventions",
    title: "HOD Intervention and Escalation Report",
    period: state.term,
    filters: { Department: department },
    columns: ["Student", "Course", "Risk Level", "Trigger", "Intervention", "Owner", "Status", "Escalation Level"],
    rows: interventions.map((item) => {
      const student = departmentRoster.find((entry) => entry.name === item.student);
      const escalation = student ? state.escalationRecords[student.id] : undefined;
      return [item.student, student?.course ?? "—", student?.status ?? "—", student?.issue ?? "—", item.type, item.mentor, item.status, escalation?.status ?? "None"];
    }),
    summary: [["Department Interventions", interventions.length], ["Active", activeInterventions], ["Open Escalations", escalations.length]],
  };

  return (
    <div>
      <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-white/10 bg-[#0a1112]/90 px-4 py-4 backdrop-blur-xl sm:px-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase text-emerald-200/80">Lumina AI / HOD workspace</p>
          <h1 className="mt-1.5 text-2xl font-semibold text-white sm:text-[28px]">Department overview</h1>
          <p className="mt-1 text-sm text-zinc-400">Department-level attendance, academic performance, risk, and support activity.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3"><ReportExportButton report={{
          type: "hod-department-summary",
          title: "HOD Department Academic Report",
          period: state.term,
          filters: { Department: department },
          columns: ["Department", "Course", "Students", "Average Attendance", "Average Academic Performance", "At Risk", "Critical", "Active Interventions"],
          rows: courseSummary.map((item) => [
            department, item.course, item.students, `${item.attendance.toFixed(1)}%`,
            `${item.assessment.toFixed(1)}%`, item.atRisk,
            departmentRoster.filter((student) => student.course === item.course && student.status === "Critical").length,
            interventions.filter((intervention) => intervention.status === "Scheduled" && departmentRoster.some((student) => student.name === intervention.student && student.course === item.course)).length,
          ]),
          summary: [["Total Students", departmentRoster.length], ["Average Attendance", `${averageAttendance.toFixed(1)}%`], ["Average Academic Performance", `${averageAssessment.toFixed(1)}%`], ["At-Risk Students", riskCount], ["Active Interventions", activeInterventions]],
        }} /><ReportExportButton report={riskReport} /><ReportExportButton report={interventionReport} /><ReportExportButton report={accreditationReport} /><DemoControls /></div>
      </header>
      <main className="space-y-5 p-4 sm:p-6">
        <p className="text-xs text-zinc-400">Department: <span className="text-zinc-200">{department}</span></p>

        <section aria-label={`${department} summary`} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Department students" value={String(departmentRoster.length)} />
          <Metric label="Average attendance" value={`${averageAttendance.toFixed(1)}%`} />
          <Metric label="Average academic performance" value={`${averageAssessment.toFixed(1)}%`} />
          <Metric label="Students at risk" value={String(riskCount)} />
          <Metric label="Active interventions" value={String(activeInterventions)} detail={`${interventions.length} total department interventions`} />
          <Metric label="Open escalations" value={String(escalations.length)} />
          <Metric label="Critical risk" value={String(departmentRoster.filter((student) => student.status === "Critical").length)} />
          <Metric label="Courses monitored" value={String(courseSummary.length)} />
        </section>

        <section className={panel}>
          <div className="mb-4">
            <h2 className="font-semibold text-white">Course and mentor coverage</h2>
            <p className="mt-1 text-xs text-zinc-500">Course metrics are calculated from the shared student, gradebook, attendance, and risk data.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-left text-xs">
              <thead><tr className="border-b border-white/10 text-zinc-500"><th className="py-3">Course</th><th className="px-2 py-3">Students</th><th className="px-2 py-3">Attendance</th><th className="px-2 py-3">Academic average</th><th className="px-2 py-3">At risk</th><th className="px-2 py-3">Assigned mentors</th></tr></thead>
              <tbody>{courseSummary.map((item) => (
                <tr key={item.course} className="border-b border-white/[0.06] text-zinc-300">
                  <td className="py-3 font-medium text-white">{item.course}</td>
                  <td className="px-2 py-3">{item.students}</td>
                  <td className="px-2 py-3">{item.attendance.toFixed(1)}%</td>
                  <td className="px-2 py-3">{item.assessment.toFixed(1)}%</td>
                  <td className="px-2 py-3">{item.atRisk}</td>
                  <td className="max-w-72 px-2 py-3">{item.mentors || "—"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-2">
          <section className={panel}>
            <h2 className="font-semibold text-white">Risk and escalation review</h2>
            {escalations.length ? (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {escalations.map((item) => (
                  <li key={item.student.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                    <span className="font-medium text-white">{item.student.name} <span className="ml-1 font-normal text-zinc-500">{item.student.rollNo}</span></span>
                    <span className="text-zinc-400">{item.status} · {item.criticalSubjects.length} critical subjects</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-zinc-500">No open department escalations.</p>}
            <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-zinc-400">
              <span className="rounded-lg border border-rose-200/20 px-2.5 py-1.5">Critical: {departmentRoster.filter((student) => student.status === "Critical").length}</span>
              <span className="rounded-lg border border-amber-200/20 px-2.5 py-1.5">Moderate: {departmentRoster.filter((student) => student.status === "Moderate").length}</span>
              <span className="rounded-lg border border-emerald-200/20 px-2.5 py-1.5">Safe: {departmentRoster.filter((student) => student.status === "Safe").length}</span>
            </div>
          </section>
          <section className={panel}>
            <h2 className="font-semibold text-white">Department interventions</h2>
            {interventions.length ? (
              <ul className="mt-3 divide-y divide-white/[0.06]">
                {interventions.slice(0, 8).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-xs">
                    <span><span className="font-medium text-white">{item.student}</span><span className="ml-2 text-zinc-500">{item.type}</span></span>
                    <span className="text-zinc-400">{item.status} · {item.date}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-3 text-sm text-zinc-500">No department interventions recorded.</p>}
          </section>
        </div>
      </main>
    </div>
  );
}
