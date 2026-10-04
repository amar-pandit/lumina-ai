import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRoleDigestEmail,
  shouldSendHourlyDigest,
} from "../lib/academic-email-engine.ts";

const snapshot = {
  scopeName: "CSE",
  department: "CSE",
  className: "CSE-A",
  attendance: {
    present: 42,
    absent: 3,
    onDuty: 2,
    medicalLeave: 1,
    approvedLeave: 0,
    notMarked: 1,
    exceptions: 0,
    significantChanges: 0,
  },
  exams: {
    appearing: 45,
    absent: 2,
    medicalLeave: 1,
    onDuty: 0,
    pending: 1,
    summary: ["Midterm participation: 45"],
  },
  academicRisk: {
    critical: 4,
    newCritical: 1,
    increased: 2,
    decreased: 0,
    recovering: 3,
    interventionRequired: 4,
  },
  parentFollowUp: {
    pending: 2,
    contacted: 1,
    acknowledgementPending: 1,
    escalated: 1,
  },
  interventions: {
    new: 1,
    pending: 2,
    overdue: 1,
    recovered: 3,
  },
  escalations: 1,
  assignedStudentUpdates: [{
    studentName: "Student Example",
    rollNumber: "24CS018",
    attendance: 58,
    onDuty: 0,
    medicalLeave: 0,
    examStatus: "Absent",
    risk: "Critical",
    followUp: "Mentor review",
  }],
  departmentSummaries: [{
    department: "CSE",
    present: 42,
    absent: 3,
    onDuty: 2,
    medicalLeave: 1,
    examAppearing: 45,
    examAbsent: 2,
    criticalStudents: 4,
    escalations: 1,
    parentFollowUps: 2,
  }],
};

test("role digest content is separated by audience scope", () => {
  const mentor = buildRoleDigestEmail("MENTOR", snapshot, { generatedAt: "2026-10-04T10:00:00Z" }).body;
  const hod = buildRoleDigestEmail("HOD", snapshot, { generatedAt: "2026-10-04T10:00:00Z" }).body;
  const admin = buildRoleDigestEmail("ADMIN", snapshot, { generatedAt: "2026-10-04T10:00:00Z" }).body;

  assert.match(mentor, /Class: CSE-A/);
  assert.match(mentor, /Student Example \(24CS018\)/);
  assert.doesNotMatch(mentor, /Department breakdown:/);

  assert.match(hod, /Department: CSE/);
  assert.match(hod, /Department risk and response:/);
  assert.doesNotMatch(hod, /Student Example/);
  assert.doesNotMatch(hod, /Institution-wide summary:/);

  assert.match(admin, /Institution-wide summary:/);
  assert.match(admin, /Department breakdown:/);
  assert.doesNotMatch(admin, /Student Example/);
});

test("hourly digest honors change-only and disabled settings", () => {
  assert.equal(shouldSendHourlyDigest(null, snapshot), true);
  assert.equal(shouldSendHourlyDigest(snapshot, snapshot, { sendOnlyOnChange: true }), false);
  assert.equal(shouldSendHourlyDigest(snapshot, snapshot, { sendOnlyOnChange: false }), true);
  assert.equal(shouldSendHourlyDigest(null, snapshot, { enabled: false }), false);

  const increasedRisk = {
    ...snapshot,
    academicRisk: { ...snapshot.academicRisk, critical: 5, newCritical: 1 },
  };
  assert.equal(shouldSendHourlyDigest(snapshot, increasedRisk), true);
});
