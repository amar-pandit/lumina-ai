import test from "node:test";
import assert from "node:assert/strict";
import { canGenerateReport } from "../lib/reports/access.ts";
import { buildReportPdf } from "../lib/reports/pdf.ts";

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
