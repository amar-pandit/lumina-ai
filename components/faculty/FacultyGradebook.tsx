"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, Save, Search, TableProperties } from "lucide-react";
import { DemoControls } from "@/components/layout/DemoControls";
import { useDemoSession } from "@/components/auth/useDemoSession";
import { calculateRisk } from "@/lib/risk-engine";
import { DEMO_STATE_KEY, INITIAL_DEMO_STATE, getDemoRoster, riskThresholdsFromSettings, riskWeightsFromSettings, type DemoGradeRecord } from "@/lib/demo-model";
import { useDemoState } from "@/lib/use-demo-state";
import { buildReportCsv } from "@/lib/reports/tabular-export";
import { createGradebookWorkbookBlob } from "@/lib/reports/gradebook-excel";
import { buildGradebookReportPdf } from "@/lib/reports/pdf";
import type { ReportDocument } from "@/lib/reports/types";

const panel = "min-w-0 rounded-2xl border border-white/10 bg-[#111a1b]/90 p-5";
const riskFilters = ["All", "CRITICAL", "MODERATE", "SAFE"] as const;
const gradebookColumns = ["Student", "Roll Number", "CIA / 30", "Midterm / 30", "Lab / 25", "Assignment / 15", "Total / 100", "Percentage", "Normalized", "Risk Score", "Risk Level"];

function scoreFor(record: DemoGradeRecord) {
  return record.cia * 0.3 + record.midterm * 0.3 + record.lab * 0.25 + record.assignment * 0.15;
}

function riskTone(category: "SAFE" | "MODERATE" | "CRITICAL") {
  if (category === "CRITICAL") return "border-rose-200/20 bg-rose-200/[0.07] text-rose-100";
  if (category === "MODERATE") return "border-amber-200/20 bg-amber-200/[0.07] text-amber-100";
  return "border-emerald-200/20 bg-emerald-200/[0.07] text-emerald-100";
}

export function FacultyGradebook() {
  const [demoState, setDemoState] = useDemoState(DEMO_STATE_KEY, INITIAL_DEMO_STATE);
  const { session, ready } = useDemoSession();
  const roster = getDemoRoster(demoState);
  const availableCourses = useMemo(() => [...new Set(roster.map((student) => student.course))], [roster]);
  const [selectedCourse, setSelectedCourse] = useState("Data Structures");
  const [query, setQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState<(typeof riskFilters)[number]>("All");
  const [normalization, setNormalization] = useState(0);
  const [saved, setSaved] = useState(true);
  const [generating, setGenerating] = useState<"pdf" | "csv" | "excel" | null>(null);
  const [exportToast, setExportToast] = useState<{ message: string; error: boolean } | null>(null);
  const toastTimer = useRef<number | null>(null);
  const students = useMemo(() => roster.filter((student) => (
    student.course === selectedCourse
    && `${student.name} ${student.rollNo}`.toLowerCase().includes(query.toLowerCase())
    && (riskFilter === "All" || student.courseRisk.category === riskFilter)
  )), [query, riskFilter, roster, selectedCourse]);

  const recordFor = (studentId: number): DemoGradeRecord => (
    demoState.gradebook[studentId] ?? { cia: 0, midterm: 0, lab: 0, assignment: 0 }
  );

  const gradebookData = useMemo(() => students.map((student) => {
    const record = demoState.gradebook[student.id] ?? { cia: 0, midterm: 0, lab: 0, assignment: 0 };
    const total = scoreFor(record);
    const normalized = Math.max(0, Math.min(100, total + normalization));
    const risk = calculateRisk({
      attendance: student.attendance,
      assessmentAverage: total,
      academicVelocity: student.velocity,
      assignmentPerformance: record.assignment,
      labCompletion: record.lab,
    }, riskWeightsFromSettings(demoState.settings), riskThresholdsFromSettings(demoState.settings));
    return { student, record, total, normalized, risk };
  }), [students, demoState.gradebook, demoState.settings, normalization]);
  const gradebookReport = useMemo<ReportDocument>(() => {
    const average = gradebookData.length
      ? gradebookData.reduce((sum, row) => sum + row.total, 0) / gradebookData.length
      : 0;
    return {
      type: "faculty-gradebook",
      title: "Gradebook Report",
      period: demoState.term,
      reportSheetName: "Gradebook",
      summarySheetName: "Summary",
      columns: gradebookColumns,
      rows: gradebookData.map(({ student, record, total, normalized, risk }) => [
        student.name,
        student.rollNo,
        Number((record.cia * 0.3).toFixed(1)),
        Number((record.midterm * 0.3).toFixed(1)),
        Number((record.lab * 0.25).toFixed(1)),
        Number((record.assignment * 0.15).toFixed(1)),
        Number(total.toFixed(1)),
        Number(total.toFixed(1)),
        Number(normalized.toFixed(1)),
        risk.score,
        risk.category,
      ]),
      summary: [
        ["Course", selectedCourse],
        ["Term", demoState.term],
        ["Total Students", gradebookData.length],
        ["Average Percentage", `${average.toFixed(1)}%`],
        ["Safe Students", gradebookData.filter(({ risk }) => risk.category === "SAFE").length],
        ["Moderate Students", gradebookData.filter(({ risk }) => risk.category === "MODERATE").length],
        ["Critical Students", gradebookData.filter(({ risk }) => risk.category === "CRITICAL").length],
      ],
    };
  }, [demoState.term, gradebookData, selectedCourse]);

  useEffect(() => () => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
  }, []);

  const notifyExport = (message: string, error = false) => {
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    setExportToast({ message, error });
    toastTimer.current = window.setTimeout(() => setExportToast(null), 3200);
  };

  const exportReport = async (format: "pdf" | "csv" | "excel") => {
    setGenerating(format);
    setExportToast(null);
    try {
      if (!session) throw new Error("A verified faculty session is required to export this report.");
      if (gradebookReport.rows.length === 0) throw new Error("No students are available to export.");
      const authorization = await fetch("/api/reports/authorize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportType: gradebookReport.type }),
      });
      if (!authorization.ok) {
        const authorizationBody: unknown = await authorization.json().catch(() => null);
        const serverMessage = typeof authorizationBody === "object" && authorizationBody !== null
          && "error" in authorizationBody && typeof authorizationBody.error === "string"
          ? authorizationBody.error
          : "";
        throw new Error(authorization.status === 401
          ? "Please sign in again."
          : authorization.status === 403
            ? "You do not have permission to export this report."
            : authorization.status >= 500
              ? "Report generation failed. Please try again."
              : serverMessage || `Report authorization failed with ${authorization.status}.`);
      }

      const generatedAt = new Date();
      let blob: Blob;
      let filename: string;
      if (format === "pdf") {
        const pdf = buildGradebookReportPdf(gradebookReport, {
          course: selectedCourse,
          term: demoState.term,
          faculty: session.user.name,
          generatedAt,
        });
        blob = pdf.output("blob");
        filename = "Lumina_Gradebook_Report.pdf";
      } else if (format === "csv") {
        blob = new Blob([buildReportCsv(gradebookReport)], { type: "text/csv;charset=utf-8" });
        filename = "Lumina_Gradebook_Report.csv";
      } else {
        blob = await createGradebookWorkbookBlob(gradebookReport, session.user.name, generatedAt);
        filename = "Lumina_Gradebook_Report.xlsx";
      }

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      notifyExport(`${format === "pdf" ? "PDF" : format === "csv" ? "CSV" : "Excel"} report downloaded.`);
    } catch (cause) {
      console.error(`${format.toUpperCase()} gradebook export failed.`, cause);
      notifyExport(cause instanceof Error ? cause.message : "Unable to generate the report.", true);
    } finally {
      setGenerating(null);
    }
  };

  const updateGrade = (studentId: number, key: keyof DemoGradeRecord, value: number) => {
    const normalizedValue = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
    setDemoState((previous) => ({
      ...previous,
      gradebook: {
        ...previous.gradebook,
        [studentId]: { ...recordFor(studentId), ...previous.gradebook[studentId], [key]: normalizedValue },
      },
    }));
    setSaved(false);
  };

  const saveGrades = () => {
    setDemoState((previous) => ({ ...previous, gradebook: { ...previous.gradebook } }));
    setSaved(true);
  };

  return (
    <div>
      <header className="border-b border-white/10 bg-[#0a1112]/90 px-4 py-4 backdrop-blur-xl sm:px-6">
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase text-emerald-200/80">Faculty workspace <span className="px-1.5 text-zinc-600">/</span> Demo mode</p>
            <h1 className="mt-1 text-xl font-semibold text-white sm:text-2xl">Demo Gradebook</h1>
            <p className="mt-1 text-xs text-zinc-400">Edit marks and review risk calculated with the shared academic risk engine.</p>
          </div>
          <DemoControls />
        </div>
      </header>

      <main className="mx-auto max-w-[1680px] space-y-5 p-4 sm:p-6">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2 text-[10px] text-zinc-500">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          Mark edits update the local demo register immediately; Save confirms the current gradebook.
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-zinc-400">{selectedCourse} · {students.length} matching students</p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="sr-only" htmlFor="gradebook-assigned-course">Assigned course</label>
            <select id="gradebook-assigned-course" aria-label="Gradebook assigned course" value={selectedCourse} onChange={(event) => setSelectedCourse(event.target.value)} className="rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-200">
              {availableCourses.map((course) => <option key={course}>{course}</option>)}
            </select>
            <button type="button" onClick={saveGrades} className="inline-flex items-center gap-2 rounded-xl bg-emerald-200 px-4 py-2.5 text-xs font-semibold text-[#0b1712]">
              <Save className="h-4 w-4" />{saved ? "Saved" : "Save gradebook"}
            </button>
            <section aria-label="Export Report" className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.025] p-2">
              <span className="px-1 text-xs font-medium text-zinc-400">Export Report</span>
              <button type="button" disabled={!ready || !session || generating !== null || students.length === 0} onClick={() => void exportReport("pdf")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50">
                <FileText className="h-3.5 w-3.5" />{generating === "pdf" ? "Generating PDF..." : "Download PDF"}
              </button>
              <button type="button" disabled={!ready || !session || generating !== null || students.length === 0} onClick={() => void exportReport("csv")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50">
                <TableProperties className="h-3.5 w-3.5" />{generating === "csv" ? "Generating CSV..." : "Download CSV"}
              </button>
              <button type="button" disabled={!ready || !session || generating !== null || students.length === 0} onClick={() => void exportReport("excel")} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-200 hover:bg-white/[0.05] disabled:opacity-50">
                <FileSpreadsheet className="h-3.5 w-3.5" />{generating === "excel" ? "Generating Excel..." : "Download Excel"}
              </button>
            </section>
          </div>
        </div>

        <section className={panel}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-white">Assessment editor</h2>
              <p className="mt-1 text-xs text-zinc-500">Each mark is entered as a percentage of its maximum.</p>
            </div>
            <label className="flex items-center gap-3 text-xs text-zinc-400">
              Normalization preview
              <input aria-label="Normalization preview" type="range" min={-10} max={10} value={normalization} onChange={(event) => setNormalization(Number(event.target.value))} />
              <span className="w-10 text-right text-white">{normalization > 0 ? "+" : ""}{normalization}%</span>
            </label>
          </div>
          <div className="mb-4 flex flex-wrap gap-2">
            <label className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
              <input aria-label="Search gradebook" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search student or roll" className="w-full rounded-xl border border-white/10 bg-[#0b1213] py-2.5 pl-9 pr-3 text-xs text-white outline-none" />
            </label>
            <select aria-label="Filter gradebook by risk" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value as (typeof riskFilters)[number])} className="rounded-xl border border-white/10 bg-[#0b1213] px-3 py-2.5 text-xs text-zinc-300">
              {riskFilters.map((filter) => <option key={filter} value={filter}>{filter === "All" ? "All risk levels" : filter}</option>)}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1020px] w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 text-zinc-500">
                  <th className="py-3 pr-3">Student</th>
                  <th className="px-2 py-3">CIA /30%</th>
                  <th className="px-2 py-3">Midterm /30%</th>
                  <th className="px-2 py-3">Lab /25%</th>
                  <th className="px-2 py-3">Assignment /15%</th>
                  <th className="px-2 py-3">Total /100</th>
                  <th className="px-2 py-3">Percentage</th>
                  <th className="px-2 py-3">Normalized</th>
                  <th className="py-3">Risk</th>
                </tr>
              </thead>
              <tbody>
                {gradebookData.map(({ student, record, total, normalized, risk }) => {
                  const inputFor = (key: keyof DemoGradeRecord, label: string) => (
                    <input
                      aria-label={`${student.name} ${label} score`}
                      type="number"
                      min={0}
                      max={100}
                      value={record[key]}
                      onChange={(event) => updateGrade(student.id, key, Number(event.target.value))}
                      className="w-16 rounded-lg border border-white/10 bg-[#0b1213] px-2 py-1.5 text-center text-xs text-white"
                    />
                  );

                  return (
                    <tr key={student.id} className="border-b border-white/[0.06] text-zinc-300">
                      <td className="py-2.5 pr-3"><span className="font-medium text-white">{student.name}</span><span className="ml-2 font-mono text-zinc-600">{student.rollNo}</span></td>
                      <td className="px-2">{inputFor("cia", "CIA")}</td>
                      <td className="px-2">{inputFor("midterm", "midterm")}</td>
                      <td className="px-2">{inputFor("lab", "lab")}</td>
                      <td className="px-2">{inputFor("assignment", "assignment")}</td>
                      <td className="px-2 font-semibold text-white">{total.toFixed(1)}</td>
                      <td className="px-2 text-white">{total.toFixed(1)}%</td>
                      <td className="px-2 text-emerald-100">{normalized.toFixed(1)}%</td>
                      <td><span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-medium ${riskTone(risk.category)}`}>{risk.score.toFixed(1)} · {risk.category}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {students.length === 0 ? <p className="py-7 text-center text-sm text-zinc-500">No students match those filters.</p> : null}
          </div>
          <p className="mt-4 text-[11px] text-zinc-500">Normalization preview is illustrative and does not alter original assessment values.</p>
        </section>
      </main>
      {exportToast ? <div role={exportToast.error ? "alert" : "status"} aria-live="polite" className={`fixed bottom-5 right-5 z-[90] flex items-center gap-2 rounded-xl border px-4 py-3 text-sm shadow-xl ${exportToast.error ? "border-rose-200/20 bg-[#241314] text-rose-100" : "border-emerald-200/20 bg-[#102019] text-emerald-100"}`}>
        {exportToast.error ? <span aria-hidden="true">!</span> : <Download className="h-4 w-4" />}{exportToast.message}
      </div> : null}
    </div>
  );
}
