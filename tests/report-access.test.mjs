import test from "node:test";
import assert from "node:assert/strict";
import { canGenerateReport } from "../lib/reports/access.ts";
import { buildReportPdf } from "../lib/reports/pdf.ts";
import XLSX from "xlsx-js-style";
import { buildReportCsv, buildReportWorkbook } from "../lib/reports/tabular-export.ts";
import { buildGradebookReportPdf } from "../lib/reports/pdf.ts";
import { createGradebookWorkbookBlob } from "../lib/reports/gradebook-excel.ts";
import ExcelJS from "exceljs";

test("report access is determined by authenticated role", () => {
  assert.equal(canGenerateReport("FACULTY", "faculty-attendance"), true);
  assert.equal(canGenerateReport("FACULTY", "admin-institution-summary"), false);
  assert.equal(canGenerateReport("MENTOR", "mentor-risk"), true);
  assert.equal(canGenerateReport("MENTOR", "faculty-gradebook"), false);
  assert.equal(canGenerateReport("HOD", "hod-department-summary"), true);
  assert.equal(canGenerateReport("HOD", "admin-accreditation"), false);
  assert.equal(canGenerateReport("ADMIN", "admin-parent-gateway"), true);
  assert.equal(canGenerateReport("ADMIN", "hod-department-summary"), true);
  assert.equal(canGenerateReport("STUDENT", "faculty-attendance"), false);
});

test("report permissions normalize roles and preserve role boundaries", () => {
  assert.equal(canGenerateReport("faculty", "faculty-gradebook"), true);
  assert.equal(canGenerateReport("FACULTY", "faculty-attendance"), true);
  assert.equal(canGenerateReport("Faculty", "faculty-heatmap"), true);
  assert.equal(canGenerateReport("FACULTY", "admin-institution-summary"), false);
  assert.equal(canGenerateReport("MENTOR", "mentor-academic"), true);
  assert.equal(canGenerateReport("mentor", "faculty-gradebook"), false);
  assert.equal(canGenerateReport("HOD", "hod-risk"), true);
  assert.equal(canGenerateReport("HOD", "faculty-gradebook"), true);
  assert.equal(canGenerateReport("HOD", "admin-accreditation"), false);
  assert.equal(canGenerateReport("ADMIN", "hod-interventions"), true);
  assert.equal(canGenerateReport("ADMIN", "admin-institution-summary"), true);
  assert.equal(canGenerateReport("ADMIN", "faculty-gradebook"), true);
  assert.equal(canGenerateReport("ADMIN", "mentor-risk"), true);
  assert.equal(canGenerateReport("ADMIN", "student-progress"), false);
  assert.equal(canGenerateReport("STUDENT", "student-progress"), true);
  assert.equal(canGenerateReport("STUDENT", "faculty-gradebook"), false);
  assert.equal(canGenerateReport("ROOT", "admin-institution-summary"), false);
});

test("report PDF is a valid multipage A4 document for the demo roster size", () => {
  const report = {
    title: "Faculty Attendance Report",
    type: "faculty-attendance",
    period: "Fall 2026",
    columns: ["Student", "Roll", "Attendance", "Status", "Course", "Risk", "Present", "Absent", "On Duty", "Medical Leave", "Total Classes"],
    rows: Array.from({ length: 60 }, (_, index) => [
      `Demo Student ${index + 1}`,
      `24CS${String(index + 1).padStart(3, "0")}`,
      `${60 + index % 40}%`,
      index % 2 ? "Present" : "Absent",
      "Data Structures",
      "MODERATE",
      "18",
      "2",
      "0",
      "0",
      "20",
    ]),
  };
  const pdf = buildReportPdf(report, "Faculty Demo", "FACULTY", new Date("2026-10-03T10:00:00Z"));
  const bytes = new Uint8Array(pdf.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  assert.ok(pdf.getNumberOfPages() > 1);
  assert.ok(pdf.internal.pageSize.getWidth() < pdf.internal.pageSize.getHeight());
  const pages = pdf.internal.pages.slice(1);
  pages.forEach((page, index) => {
    const contents = page.join("");
    assert.ok(contents.includes(`Page ${index + 1} of ${pages.length}`));
    assert.ok(contents.includes("CONFIDENTIAL"));
    assert.ok(contents.includes("DEMO REPORT"));
    assert.ok(contents.includes("Student"));
  });

  const contents = pages.map((page) => page.join("")).join("");
  report.rows.forEach((row) => assert.ok(contents.includes(`(${row[1]})`), `missing roster row ${row[1]}`));
});

test("Excel and CSV exports preserve report rows, formatting, filters, and workbook sheets", () => {
  const report = {
    title: "Faculty Academic Report",
    type: "faculty-dashboard",
    reportSheetName: "Attendance",
    summarySheetName: "Faculty Summary",
    columns: ["Student", "Risk Score", "Risk Level"],
    rows: [
      ["Amar Kumar", 29.5, "SAFE"],
      ["Rahul Sharma", 48.9, "MODERATE"],
      ["Aarav Mehta", 75, "CRITICAL"],
      ["Riya Recovering", 39.3, "RECOVERING"],
    ],
    summary: [["Total Students", 4]],
    workbookSheets: [{
      name: "Risk",
      columns: ["Student", "Risk Score", "Risk Level"],
      rows: [["Amar Kumar", 29.5, "SAFE"]],
    }],
  };
  const workbook = buildReportWorkbook(report, "Dr. Meera Shah", new Date("2026-10-03T10:00:00Z"));
  assert.deepEqual(workbook.SheetNames, ["Attendance", "Risk", "Faculty Summary"]);
  const riskSheet = workbook.Sheets.Attendance;
  assert.equal(riskSheet["!autofilter"].ref, "A1:C5");
  assert.equal(riskSheet["!freeze"].ySplit, 1);
  assert.equal(riskSheet.B2.s.fill.fgColor.rgb, "E2F0D9");
  assert.equal(riskSheet.C3.s.fill.fgColor.rgb, "FFF2CC");
  assert.equal(riskSheet.C4.s.fill.fgColor.rgb, "FCE4D6");
  assert.equal(riskSheet.C5.s.fill.fgColor.rgb, "DDEBF7");

  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer", cellStyles: true });
  const reopened = XLSX.read(bytes, { type: "buffer", cellStyles: true });
  assert.deepEqual(reopened.SheetNames, workbook.SheetNames);
  assert.equal(reopened.Sheets.Attendance["A2"].v, "Amar Kumar");
  assert.equal(reopened.Sheets.Attendance["B3"].v, 48.9);
  assert.equal(reopened.Sheets.Attendance["C4"].v, "CRITICAL");

  const csv = buildReportCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.includes('"Amar Kumar","29.5","SAFE"'));
  assert.equal(csv.split("\r\n").length, report.rows.length + 1);

  const escapedCsv = buildReportCsv({
    ...report,
    columns: ["Name", "Note"],
    rows: [['=HYPERLINK("x")', 'Contains, comma and "quotes"']],
  });
  assert.ok(escapedCsv.includes(`"'=HYPERLINK(""x"")","Contains, comma and ""quotes"""`));
});

test("Gradebook PDF and exports use every calculated row, landscape layout, and a valid styled workbook", async () => {
  const columns = [
    "Student", "Roll Number", "CIA / 30", "Midterm / 30", "Lab / 25",
    "Assignment / 15", "Total / 100", "Percentage", "Normalized", "Risk Score", "Risk Level",
  ];
  const rows = Array.from({ length: 60 }, (_, index) => [
    `Gradebook Student ${index + 1}`,
    `DB${String(index + 1).padStart(3, "0")}`,
    24,
    25.5,
    20,
    12,
    81.5,
    81.5,
    83.5,
    12.4,
    ["SAFE", "MODERATE", "CRITICAL"][index % 3],
  ]);
  const report = {
    title: "Gradebook Report",
    type: "faculty-gradebook",
    period: "Fall 2026",
    reportSheetName: "Gradebook",
    summarySheetName: "Summary",
    columns,
    rows,
    summary: [
      ["Course", "Database Systems"],
      ["Total Students", rows.length],
      ["Average Percentage", "81.5%"],
      ["Safe Students", 20],
      ["Moderate Students", 20],
      ["Critical Students", 20],
    ],
  };
  const generatedAt = new Date("2026-10-03T10:00:00Z");
  const pdf = buildGradebookReportPdf(report, {
    course: "Database Systems",
    term: "Fall 2026",
    faculty: "Dr. Meera Shah",
    generatedAt,
  });
  const pdfBytes = new Uint8Array(pdf.output("arraybuffer"));
  assert.equal(new TextDecoder().decode(pdfBytes.slice(0, 5)), "%PDF-");
  assert.ok(pdf.internal.pageSize.getWidth() > pdf.internal.pageSize.getHeight());
  assert.ok(pdf.getNumberOfPages() > 1);
  const pageContents = pdf.internal.pages.slice(1).map((page) => page.join(""));
  pageContents.forEach((content, index) => {
    assert.ok(content.includes(`Page ${index + 1} of ${pageContents.length}`));
    assert.ok(content.includes("Lumina AI"));
    assert.ok(content.includes("Student"));
  });
  const fullPdfText = pageContents.join("");
  rows.forEach((row) => assert.ok(fullPdfText.includes(row[1]), `missing gradebook roll ${row[1]}`));
  assert.ok(fullPdfText.includes("Database Systems"));
  assert.ok(fullPdfText.includes("81.5%"));

  const csv = buildReportCsv(report);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.ok(csv.startsWith(`\uFEFF${columns.map((column) => `"${column}"`).join(",")}`));
  assert.ok(csv.includes('"Gradebook Student 60","DB060","24","25.5","20","12","81.5","81.5","83.5","12.4","CRITICAL"'));
  assert.equal(csv.split("\r\n").length, rows.length + 1);

  const excelBlob = await createGradebookWorkbookBlob(report, "Dr. Meera Shah", generatedAt);
  assert.equal(excelBlob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const excel = new ExcelJS.Workbook();
  await excel.xlsx.load(await excelBlob.arrayBuffer());
  assert.deepEqual(excel.worksheets.map((sheet) => sheet.name), ["Gradebook", "Summary"]);
  const sheet = excel.getWorksheet("Gradebook");
  assert.ok(sheet);
  assert.equal(sheet.rowCount, rows.length + 1);
  assert.equal(sheet.getCell("A61").value, "Gradebook Student 60");
  assert.equal(sheet.views[0].state, "frozen");
  assert.equal(sheet.views[0].ySplit, 1);
  assert.equal(sheet.autoFilter, `A1:K${rows.length + 1}`);
  assert.equal(sheet.getCell("H2").numFmt, '0.0"%"');
  assert.equal(sheet.getCell("K2").value, "SAFE");
  assert.equal(sheet.getCell("K2").fill.fgColor.argb, "FFE2F0D9");
  assert.equal(sheet.getCell("K3").value, "MODERATE");
  assert.equal(sheet.getCell("K3").fill.fgColor.argb, "FFFFF2CC");
  assert.equal(sheet.getCell("K4").value, "CRITICAL");
  assert.equal(sheet.getCell("K4").fill.fgColor.argb, "FFFCE4D6");
  assert.equal(excel.getWorksheet("Summary")?.getCell("A3").value, "Course");
});
