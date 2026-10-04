import XLSX from "xlsx-js-style";
import type { ReportDocument, ReportSheet } from "@/lib/reports/types";

function safeSheetName(name: string) {
  return name.replace(/[\\/?*[\]:]/g, " ").trim().slice(0, 31) || "Report";
}

function safeCsvValue(value: string | number) {
  const text = String(value);
  return /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function safeSpreadsheetValue(value: string | number) {
  return typeof value === "number" ? value : safeCsvValue(value);
}

function sheetFromRows(columns: string[], rows: Array<Array<string | number>>) {
  const sheet = XLSX.utils.aoa_to_sheet([
    columns,
    ...rows.map((row) => columns.map((_, index) => safeSpreadsheetValue(row[index] ?? ""))),
  ]);
  const range = XLSX.utils.decode_range(sheet["!ref"] ?? "A1:A1");
  const widths = columns.map((column, index) => {
    const contentWidth = Math.max(
      column.length,
      ...rows.slice(0, 100).map((row) => String(row[index] ?? "").length),
    );
    return { wch: Math.max(12, Math.min(32, contentWidth + 2)) };
  });
  sheet["!cols"] = widths;
  sheet["!autofilter"] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: range.e.r, c: range.e.c } }) };
  sheet["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft", state: "frozen" };

  for (let column = 0; column < columns.length; column += 1) {
    const address = XLSX.utils.encode_cell({ r: 0, c: column });
    if (!sheet[address]) continue;
    sheet[address].s = {
      fill: { fgColor: { rgb: "135942" } },
      font: { bold: true, color: { rgb: "FFFFFF" } },
      alignment: { vertical: "center", wrapText: true },
      border: { bottom: { style: "thin", color: { rgb: "9AAFA5" } } },
    };
  }
  for (let row = 1; row <= range.e.r; row += 1) {
    for (let column = 0; column <= range.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      const cell = sheet[address];
      if (!cell) continue;
      const header = columns[column]?.toLowerCase() ?? "";
      const value = String(cell.v ?? "").trim().toUpperCase();
      const riskLevelColumn = columns.findIndex((candidate) => /risk level|current status/.test(candidate.toLowerCase()));
      const rowRiskLevel = riskLevelColumn >= 0
        ? String(sheet[XLSX.utils.encode_cell({ r: row, c: riskLevelColumn })]?.v ?? "").trim().toUpperCase()
        : "";
      const color = value === "SAFE"
        ? ["E2F0D9", "375623"]
        : value === "MODERATE"
          ? ["FFF2CC", "7F6000"]
          : value === "CRITICAL"
            ? ["FCE4D6", "9C0006"]
            : value === "RECOVERING"
              ? ["DDEBF7", "1F4E78"]
              : ["E7E6E6", "595959"];
      const isRiskStatus = /risk level|current status/.test(header);
      const isRecovering = /recovery progress|intervention status/.test(header) && value.includes("RECOVER");
      const isRiskScore = /risk score/.test(header);
      const numericRiskScore = typeof cell.v === "number" ? cell.v : Number(cell.v);
      const isScoreNumber = isRiskScore && Number.isFinite(numericRiskScore);
      const scoreColor = isScoreNumber
        ? rowRiskLevel === "SAFE" ? ["E2F0D9", "375623"]
          : rowRiskLevel === "MODERATE" ? ["FFF2CC", "7F6000"]
            : rowRiskLevel === "CRITICAL" ? ["FCE4D6", "9C0006"]
              : numericRiskScore <= 30 ? ["E2F0D9", "375623"]
                : numericRiskScore <= 60 ? ["FFF2CC", "7F6000"]
                  : ["FCE4D6", "9C0006"]
        : null;
      const styleColor = isRiskStatus
        ? color
        : isRecovering
          ? ["DDEBF7", "1F4E78"]
          : scoreColor;
      const alternate = row % 2 === 0 ? "F4F8F6" : "FFFFFF";
      cell.s = {
        fill: { fgColor: { rgb: styleColor?.[0] ?? alternate } },
        font: { color: { rgb: styleColor?.[1] ?? "26332D" } },
        alignment: { vertical: "center", wrapText: true },
        border: {
          bottom: { style: "thin", color: { rgb: "D9E2DD" } },
          right: { style: "thin", color: { rgb: "E3EAE6" } },
        },
        ...(/attendance|performance|progress|percentage|normalized/.test(header) && typeof cell.v === "number"
          ? { numFmt: '0.0"%"' }
          : {}),
        ...((/cia|midterm|lab|assignment|total/.test(header) || isRiskScore) && typeof cell.v === "number"
          ? { numFmt: "0.0" }
          : {}),
      };
    }
  }
  return sheet;
}

export function buildReportWorkbook(report: ReportDocument, generatedBy: string, generatedAt: Date) {
  if (report.rows.length === 0) throw new Error("No report data available.");
  const workbook = XLSX.utils.book_new();
  const sheets: ReportSheet[] = [
    { name: report.reportSheetName ?? "Report", columns: report.columns, rows: report.rows },
    ...(report.workbookSheets ?? []),
  ];
  const names = new Set<string>();
  for (const item of sheets) {
    const name = safeSheetName(item.name);
    if (names.has(name)) continue;
    names.add(name);
    XLSX.utils.book_append_sheet(workbook, sheetFromRows(item.columns, item.rows), name);
  }

  const summaryRows: Array<[string, string | number]> = [
    ["LUMINA AI", "Academic Intelligence System"],
    ["Report", report.title],
    ["Generated By", generatedBy],
    ["Role", report.type.split("-")[0].toUpperCase()],
    ["Generated", generatedAt.toLocaleString()],
    ["Reporting Period", report.period ?? "Current"],
    ...report.summary ?? [],
  ];
  const summaryName = safeSheetName(report.summarySheetName ?? "Summary");
  if (!names.has(summaryName)) {
    XLSX.utils.book_append_sheet(workbook, sheetFromRows(["Metric", "Value"], summaryRows), summaryName);
  }
  return workbook;
}

export function buildReportCsv(report: ReportDocument) {
  if (report.rows.length === 0) throw new Error("No report data available.");
  const quote = (value: string | number) => `"${safeCsvValue(value).replaceAll('"', '""')}"`;
  return `\uFEFF${[report.columns, ...report.rows.map((row) => report.columns.map((_, index) => row[index] ?? ""))]
    .map((row) => row.map(quote).join(","))
    .join("\r\n")}`;
}

export function createReportWorkbookBlob(report: ReportDocument, generatedBy: string, generatedAt = new Date()) {
  const workbook = buildReportWorkbook(report, generatedBy, generatedAt);
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
  return new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}
