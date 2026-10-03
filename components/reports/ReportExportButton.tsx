"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileText, History, TableProperties, X } from "lucide-react";
import { useDemoSession } from "@/components/auth/useDemoSession";
import type { ReportDocument, ReportHistoryItem } from "@/lib/reports/types";
import { buildReportPdf } from "@/lib/reports/pdf";
import { buildReportCsv, createReportWorkbookBlob } from "@/lib/reports/tabular-export";

const REPORT_HISTORY_KEY = "lumina-report-history";

function safeFilePart(value: string) {
  return value.normalize("NFKD").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function ReportExportButton({ report }: { report: ReportDocument }) {
  const { session, ready } = useDemoSession();
  const [pdfUrl, setPdfUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preparing, setPreparing] = useState<"pdf" | "excel" | "csv" | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<ReportHistoryItem[]>([]);
  const pdfRef = useRef<ReturnType<typeof buildReportPdf> | null>(null);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const createPreview = () => {
    if (!session) {
      setError("A verified session is required to export reports.");
      return null;
    }
    const pdf = buildReportPdf(report, session.user.name, session.role, new Date());
    const blob = pdf.output("blob");
    const nextUrl = URL.createObjectURL(blob);
    setPdfUrl((previous) => { if (previous) URL.revokeObjectURL(previous); return nextUrl; });
    pdfRef.current = pdf;
    setError("");
    setNotice("");
    return pdf;
  };
  const authorize = async () => {
    const response = await fetch("/api/reports/authorize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reportType: report.type }),
    });
    if (!response.ok) throw new Error(`Report authorization failed with ${response.status}.`);
  };
  const showPreview = async () => {
    setBusy(true);
    setPreparing("pdf");
    setError("");
    try {
      await authorize();
      createPreview();
    } catch (cause) {
      console.error("PDF generation failed.", cause);
      setError(cause instanceof Error && cause.message.includes("403")
        ? "Your authenticated role cannot generate this report."
        : "Unable to generate this PDF. Please try again.");
    } finally { setPreparing(null); setBusy(false); }
  };
  const download = async (usePreview = true) => {
    setBusy(true);
    try {
      await authorize();
      const pdf = usePreview ? pdfRef.current ?? createPreview() : createPreview();
      if (pdf) pdf.save(`Lumina_${safeFilePart(report.title)}_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (cause) {
      console.error("PDF download failed.", cause);
      setError(cause instanceof Error && cause.message.includes("403")
        ? "Your authenticated role cannot generate this report."
        : "Unable to download this PDF.");
    } finally { setBusy(false); }
  };
  const downloadTabular = async (format: "excel" | "csv") => {
    setBusy(true);
    setPreparing(format);
    setError("");
    setNotice("");
    try {
      if (report.rows.length === 0) throw new Error("No report data available.");
      await authorize();
      if (!session) throw new Error("A verified session is required to export reports.");
      const generatedAt = new Date();
      const content = format === "excel"
        ? createReportWorkbookBlob(report, session.user.name, generatedAt)
        : new Blob([buildReportCsv(report)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(content);
      const anchor = document.createElement("a");
      const role = {
        faculty: "Faculty",
        mentor: "Mentor",
        hod: "HOD",
        admin: "Admin",
      }[report.type.split("-")[0]] ?? "Report";
      const extension = format === "excel" ? "xlsx" : "csv";
      anchor.href = url;
      anchor.download = `Lumina_${role}_Report_${generatedAt.toISOString().slice(0, 10)}.${extension}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      setNotice(`${format === "excel" ? "Excel" : "CSV"} report downloaded.`);
    } catch (cause) {
      console.error(`${format.toUpperCase()} report export failed.`, cause);
      const message = cause instanceof Error && cause.message === "No report data available."
        ? "No report data available."
        : cause instanceof Error && cause.message.includes("403")
          ? "Your authenticated role cannot generate this report."
          : `Unable to generate ${format === "excel" ? "Excel" : "CSV"} report. Please try again.`;
      setError(message);
    } finally {
      setPreparing(null);
      setBusy(false);
    }
  };
  const saveReport = async () => {
    setBusy(true);
    try {
      await authorize();
      createPreview();
      if (!session) throw new Error("A verified session is required to save a report.");
      const current = readHistoryStore();
      const item: ReportHistoryItem = {
        reportId: crypto.randomUUID(),
        reportName: report.title,
        reportType: report.type,
        generatedBy: session.user.name,
        generatedByRole: session.role,
        generatedAt: new Date().toISOString(),
        period: report.period ?? "Current",
        filters: report.filters ?? {},
      };
      writeHistoryStore({
        ...current,
        [session.user.id]: [item, ...(current[session.user.id] ?? [])].slice(0, 100),
      });
      setNotice("Report saved to history.");
      await loadHistory();
    } catch (cause) {
      console.error("Report history save failed.", cause);
      setError("Unable to save report history.");
    } finally { setBusy(false); }
  };
  const readHistoryStore = (): Record<string, ReportHistoryItem[]> => {
    const raw = window.localStorage.getItem(REPORT_HISTORY_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("Saved report history is invalid.");
    }
    return parsed as Record<string, ReportHistoryItem[]>;
  };
  const writeHistoryStore = (value: Record<string, ReportHistoryItem[]>) => {
    window.localStorage.setItem(REPORT_HISTORY_KEY, JSON.stringify(value));
  };
  const loadHistory = async () => {
    if (!session) throw new Error("A verified session is required to read report history.");
    await authorize();
    const reports = readHistoryStore()[session.user.id] ?? [];
    setHistory(reports.filter((item) => item.reportType === report.type));
  };

  return (
    <>
      <div className="inline-flex flex-wrap items-center gap-2">
        <button type="button" disabled={!ready || busy || report.rows.length === 0} onClick={() => void showPreview()} className="inline-flex items-center gap-2 rounded-lg border border-emerald-200/20 bg-emerald-200/[0.07] px-3 py-2 text-xs font-medium text-emerald-100 hover:bg-emerald-200/[0.12] disabled:opacity-50">
          <FileText className="h-3.5 w-3.5" />{preparing === "pdf" ? "Preparing PDF..." : "Export PDF"}
        </button>
        <button type="button" disabled={!ready || busy || report.rows.length === 0} onClick={() => void downloadTabular("excel")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white disabled:opacity-50">
          <FileSpreadsheet className="h-3.5 w-3.5" />{preparing === "excel" ? "Preparing Excel..." : "Export Excel"}
        </button>
        <button type="button" disabled={!ready || busy || report.rows.length === 0} onClick={() => void downloadTabular("csv")} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-medium text-zinc-300 hover:text-white disabled:opacity-50">
          <TableProperties className="h-3.5 w-3.5" />{preparing === "csv" ? "Preparing CSV..." : "Export CSV"}
        </button>
        <button type="button" disabled={!ready || busy} onClick={async () => {
          try { await loadHistory(); setHistoryOpen(true); }
          catch (cause) { console.error("Report history load failed.", cause); setError("Unable to load report history."); }
        }} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs text-zinc-300 hover:text-white">
          <History className="h-3.5 w-3.5" />Report history
        </button>
      </div>
      {report.rows.length === 0 ? <p role="status" className="mt-2 text-xs text-zinc-400">No report data available.</p> : null}
      {error ? <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p> : null}
      {notice && !pdfUrl ? <p role="status" aria-live="polite" className="mt-2 text-xs text-emerald-200">{notice}</p> : null}
      {pdfUrl ? <div role="dialog" aria-modal="true" aria-label={`${report.title} preview`} className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-8">
        <section className="flex h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#101718]">
          <header className="flex items-center justify-between gap-3 border-b border-white/10 p-4">
            <h2 className="font-semibold text-white">PDF Preview · {report.title}</h2>
            <button type="button" aria-label="Close PDF preview" onClick={() => setPdfUrl("")} className="rounded-lg border border-white/10 p-2 text-zinc-300"><X className="h-4 w-4" /></button>
          </header>
          <iframe title={`${report.title} PDF`} src={pdfUrl} className="min-h-0 flex-1 bg-white" />
          <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 p-3">
            <span role="status" aria-live="polite" className="text-xs text-emerald-200">{notice}</span>
            <span className="ml-auto flex gap-2">
            <button type="button" disabled={busy} onClick={saveReport} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-200 disabled:opacity-50">{busy ? "Saving..." : "Save Report"}</button>
            <button type="button" disabled={busy} onClick={() => void download()} className="inline-flex items-center gap-2 rounded-lg bg-emerald-200 px-4 py-2 text-sm font-semibold text-[#0b1712] disabled:opacity-50"><Download className="h-4 w-4" />Download PDF</button>
            </span>
          </footer>
        </section>
      </div> : null}
      {historyOpen ? <div role="dialog" aria-modal="true" aria-label="Report history" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4">
        <section className="w-full max-w-2xl rounded-2xl border border-white/15 bg-[#101718] p-5">
          <header className="mb-4 flex items-center justify-between"><h2 className="font-semibold text-white">Report History</h2><button type="button" aria-label="Close report history" onClick={() => setHistoryOpen(false)} className="rounded-lg border border-white/10 p-2 text-zinc-300"><X className="h-4 w-4" /></button></header>
          <ul className="max-h-[60vh] divide-y divide-white/10 overflow-y-auto">
            {history.map((item) => <li key={item.reportId} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"><span><span className="block text-white">{item.reportName}</span><span className="text-xs text-zinc-500">{item.generatedBy} · {item.generatedByRole} · {new Date(item.generatedAt).toLocaleString()} · {item.period}</span></span><span className="flex gap-2"><button type="button" onClick={() => { setHistoryOpen(false); void showPreview(); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300">Preview latest data</button><button type="button" onClick={() => { setHistoryOpen(false); void download(false); }} className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-300">Download latest</button></span></li>)}
          </ul>
          {history.length === 0 ? <p className="py-6 text-center text-sm text-zinc-500">No saved reports of this type.</p> : null}
        </section>
      </div> : null}
    </>
  );
}
