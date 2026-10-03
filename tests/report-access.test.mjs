import test from "node:test";
import assert from "node:assert/strict";
import { canGenerateReport } from "../lib/reports/access.ts";
import { buildReportPdf } from "../lib/reports/pdf.ts";
import XLSX from "xlsx-js-style";
import { buildReportCsv, buildReportWorkbook } from "../lib/reports/tabular-export.ts";

test("report access is determined by authenticated role", () => {
  assert.equal(canGenerateReport("FACULTY", "faculty-attendance"), true);
  assert.equal(canGenerateReport("FACULTY", "admin-institution-summary"), false);
  assert.equal(canGenerateReport("MENTOR", "mentor-risk"), true);
  assert.equal(canGenerateReport("MENTOR", "faculty-gradebook"), false);
  assert.equal(canGenerateReport("HOD", "hod-department-summary"), true);
  assert.equal(canGenerateReport("HOD", "admin-accreditation"), false);
  assert.equal(canGenerateReport("ADMIN", "admin-parent-gateway"), true);
  assert.equal(canGenerateReport("ADMIN", "hod-department-summary"), false);
  assert.equal(canGenerateReport("STUDENT", "faculty-attendance"), false);
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
