export type AcademicRole = "STUDENT" | "FACULTY" | "MENTOR" | "HOD" | "ADMIN";

export interface AcademicRecipient {
  id: string;
  email: string;
  name: string;
  role: AcademicRole;
  department?: string;
  className?: string;
  courses?: string[];
  assignedStudents?: string[];
}

export interface AcademicDigestSnapshot {
  scopeName?: string;
  department?: string;
  className?: string;
  departmentSummaries?: Array<{
    department: string;
    present: number;
    absent: number;
    onDuty: number;
    medicalLeave: number;
    examAppearing: number;
    examAbsent: number;
    criticalStudents: number;
    escalations: number;
    parentFollowUps: number;
  }>;
  assignedStudentUpdates?: Array<{
    studentName: string;
    rollNumber: string;
    attendance: number;
    onDuty: number;
    medicalLeave: number;
    examStatus: string;
    risk: string;
    followUp?: string;
  }>;
  escalations?: number;
  attendance: {
    present: number;
    absent: number;
    onDuty: number;
    medicalLeave: number;
    approvedLeave: number;
    notMarked: number;
    exceptions: number;
    significantChanges: number;
  };
  exams: {
    appearing: number;
    absent: number;
    medicalLeave: number;
    onDuty: number;
    pending: number;
    summary: string[];
  };
  academicRisk: {
    critical: number;
    newCritical: number;
    increased: number;
    decreased: number;
    recovering: number;
    interventionRequired: number;
  };
  parentFollowUp: {
    pending: number;
    contacted: number;
    acknowledgementPending: number;
    escalated: number;
  };
  interventions: {
    new: number;
    pending: number;
    overdue: number;
    recovered: number;
  };
  actionItems?: string[];
}

export interface AcademicEmailSettings {
  enabled: boolean;
  digestIntervalMinutes: number;
  sendOnlyOnChange: boolean;
  compactSummaryWhenIdle: boolean;
  immediateAlertsEnabled: boolean;
  maxRetryAttempts: number;
}

export interface AcademicDigestDelta {
  changed: boolean;
  summary: string[];
  compactSummary: string;
}

export const ACADEMIC_ROLES: AcademicRole[] = ["STUDENT", "FACULTY", "MENTOR", "HOD", "ADMIN"];

export const DEFAULT_ACADEMIC_EMAIL_SETTINGS: AcademicEmailSettings = {
  enabled: true,
  digestIntervalMinutes: 60,
  sendOnlyOnChange: true,
  compactSummaryWhenIdle: true,
  immediateAlertsEnabled: true,
  maxRetryAttempts: 3,
};

export function normalizeAcademicRole(role: string | AcademicRole | null | undefined): AcademicRole | null {
  if (typeof role !== "string") return null;
  const value = role.trim().toUpperCase();
  return ACADEMIC_ROLES.includes(value as AcademicRole) ? (value as AcademicRole) : null;
}

export function filterRecipientsForRole(
  role: string | AcademicRole,
  recipients: AcademicRecipient[],
  context: {
    department?: string;
    className?: string;
    course?: string;
    assignedStudentIds?: string[];
    studentId?: string;
  } = {},
): AcademicRecipient[] {
  const normalizedRole = normalizeAcademicRole(role);
  if (!normalizedRole) return [];

  return recipients.filter((recipient) => {
    if (recipient.role !== normalizedRole) return false;

    switch (normalizedRole) {
      case "ADMIN":
        return true;
      case "HOD":
        return !context.department || !recipient.department || recipient.department === context.department;
      case "FACULTY":
        if (context.course && Array.isArray(recipient.courses) && recipient.courses.length > 0) {
          return recipient.courses.includes(context.course);
        }
        if (context.className && recipient.className) {
          return recipient.className === context.className;
        }
        return true;
      case "MENTOR":
        if (Array.isArray(context.assignedStudentIds) && context.assignedStudentIds.length > 0) {
          return (recipient.assignedStudents ?? []).some((studentId) => context.assignedStudentIds!.includes(studentId));
        }
        return true;
      case "STUDENT":
        if (context.studentId) {
          return recipient.id === context.studentId;
        }
        return true;
      default:
        return true;
    }
  });
}

export function buildAcademicDigestSnapshot(overrides: Partial<AcademicDigestSnapshot> = {}): AcademicDigestSnapshot {
  const base: AcademicDigestSnapshot = {
    scopeName: "Institution",
    department: undefined,
    className: undefined,
    attendance: {
      present: 0,
      absent: 0,
      onDuty: 0,
      medicalLeave: 0,
      approvedLeave: 0,
      notMarked: 0,
      exceptions: 0,
      significantChanges: 0,
    },
    exams: {
      appearing: 0,
      absent: 0,
      medicalLeave: 0,
      onDuty: 0,
      pending: 0,
      summary: [],
    },
    academicRisk: {
      critical: 0,
      newCritical: 0,
      increased: 0,
      decreased: 0,
      recovering: 0,
      interventionRequired: 0,
    },
    parentFollowUp: {
      pending: 0,
      contacted: 0,
      acknowledgementPending: 0,
      escalated: 0,
    },
    interventions: {
      new: 0,
      pending: 0,
      overdue: 0,
      recovered: 0,
    },
    actionItems: [],
  };

  return {
    ...base,
    ...overrides,
    attendance: { ...base.attendance, ...overrides.attendance },
    exams: { ...base.exams, ...overrides.exams },
    academicRisk: { ...base.academicRisk, ...overrides.academicRisk },
    parentFollowUp: { ...base.parentFollowUp, ...overrides.parentFollowUp },
    interventions: { ...base.interventions, ...overrides.interventions },
  };
}

function metricDelta(label: string, previousValue: number, currentValue: number): number {
  return currentValue - previousValue;
}

export function summarizeAcademicDigestDelta(
  previous: Partial<AcademicDigestSnapshot> | null | undefined,
  current: AcademicDigestSnapshot,
): AcademicDigestDelta {
  const basePrevious = previous ? buildAcademicDigestSnapshot(previous) : buildAcademicDigestSnapshot({
    attendance: { present: 0, absent: 0, onDuty: 0, medicalLeave: 0, approvedLeave: 0, notMarked: 0, exceptions: 0, significantChanges: 0 },
    academicRisk: { critical: 0, newCritical: 0, increased: 0, decreased: 0, recovering: 0, interventionRequired: 0 },
    parentFollowUp: { pending: 0, contacted: 0, acknowledgementPending: 0, escalated: 0 },
    interventions: { new: 0, pending: 0, overdue: 0, recovered: 0 },
  });

  const deltas: string[] = [];
  const criticalDelta = metricDelta("critical", basePrevious.academicRisk.critical, current.academicRisk.critical);
  if (criticalDelta > 0) deltas.push(`${criticalDelta} student${criticalDelta === 1 ? "" : "s"} entered Critical Risk in the last hour.`);
  const newCriticalDelta = current.academicRisk.newCritical - (basePrevious.academicRisk.newCritical ?? 0);
  if (newCriticalDelta > 0 && criticalDelta <= 0) deltas.push(`${newCriticalDelta} new critical cases were flagged.`);
  const increasedDelta = current.academicRisk.increased - (basePrevious.academicRisk.increased ?? 0);
  if (increasedDelta > 0) deltas.push(`${increasedDelta} students showed a risk increase.`);
  const decreasedDelta = current.academicRisk.decreased - (basePrevious.academicRisk.decreased ?? 0);
  if (decreasedDelta > 0) deltas.push(`${decreasedDelta} students improved and recovered.`);

  if (current.attendance.absent > (basePrevious.attendance.absent ?? 0)) {
    const absentDelta = current.attendance.absent - (basePrevious.attendance.absent ?? 0);
    deltas.push(`${absentDelta} more students are currently marked absent.`);
  }

  if (current.parentFollowUp.escalated > (basePrevious.parentFollowUp.escalated ?? 0)) {
    const escalatedDelta = current.parentFollowUp.escalated - (basePrevious.parentFollowUp.escalated ?? 0);
    deltas.push(`${escalatedDelta} follow-up case${escalatedDelta === 1 ? "" : "s"} escalated for urgent action.`);
  }

  if (current.parentFollowUp.pending > (basePrevious.parentFollowUp.pending ?? 0)) {
    const pendingDelta = current.parentFollowUp.pending - (basePrevious.parentFollowUp.pending ?? 0);
    deltas.push(`${pendingDelta} parent follow-up case${pendingDelta === 1 ? "" : "s"} became pending.`);
  }

  if (current.interventions.new > (basePrevious.interventions.new ?? 0)) {
    const newInterventions = current.interventions.new - (basePrevious.interventions.new ?? 0);
    deltas.push(`${newInterventions} new intervention${newInterventions === 1 ? "" : "s"} were created.`);
  }

  if (current.interventions.overdue > (basePrevious.interventions.overdue ?? 0)) {
    const overdueDelta = current.interventions.overdue - (basePrevious.interventions.overdue ?? 0);
    deltas.push(`${overdueDelta} intervention follow-up${overdueDelta === 1 ? "" : "s"} became overdue.`);
  }

  if (current.attendance.significantChanges > (basePrevious.attendance.significantChanges ?? 0)) {
    const attendanceDelta = current.attendance.significantChanges - (basePrevious.attendance.significantChanges ?? 0);
    deltas.push(`${attendanceDelta} attendance deviation${attendanceDelta === 1 ? "" : "s"} need review.`);
  }

  if (current.exams.absent > (basePrevious.exams.absent ?? 0)) {
    const examAbsenceDelta = current.exams.absent - (basePrevious.exams.absent ?? 0);
    deltas.push(`${examAbsenceDelta} additional exam absence${examAbsenceDelta === 1 ? "" : "s"} were recorded.`);
  }

  if (deltas.length === 0 && current.actionItems?.length) {
    deltas.push(`Action required: ${current.actionItems.slice(0, 3).join("; ")}.`);
  }

  const changed = deltas.length > 0;
  const summary = changed
    ? deltas
    : ["No meaningful academic changes were detected in the last hour."];

  return {
    changed,
    summary,
    compactSummary: changed ? summary.join(" ") : "No meaningful change detected.",
  };
}

export function shouldSendHourlyDigest(
  previous: Partial<AcademicDigestSnapshot> | null | undefined,
  current: AcademicDigestSnapshot,
  settings: Partial<AcademicEmailSettings> = {},
): boolean {
  const digestSettings = { ...DEFAULT_ACADEMIC_EMAIL_SETTINGS, ...settings };
  if (!digestSettings.enabled) return false;
  if (!previous) return true;
  if (!digestSettings.sendOnlyOnChange) return true;
  return summarizeAcademicDigestDelta(previous, current).changed;
}

export function buildRoleDigestEmail(
  role: string | AcademicRole,
  digest: Partial<AcademicDigestSnapshot>,
  options: {
    scopeLabel?: string;
    generatedAt?: Date | string;
    actionItems?: string[];
    recipients?: AcademicRecipient[];
  } = {},
): { subject: string; body: string; recipients: AcademicRecipient[] } {
  const normalizedRole = normalizeAcademicRole(role) ?? "ADMIN";
  const scopeLabel = options.scopeLabel ?? digest.scopeName ?? "Institution";
  const generatedAt = options.generatedAt ? new Date(options.generatedAt) : new Date();
  const snapshot = buildAcademicDigestSnapshot({ ...digest, scopeName: scopeLabel, actionItems: options.actionItems ?? digest.actionItems ?? [] });
  const recipients = options.recipients ?? [];
  const subject = `[Lumina AI] ${roleLabel(normalizedRole)} Academic Update — ${scopeLabel}`;
  const lines = [`Academic ${roleLabel(normalizedRole).toLowerCase()} update for ${scopeLabel}.`, `Generated at: ${generatedAt.toISOString()}`, ""];

  if (normalizedRole === "MENTOR") {
    lines.push(
      `Class: ${snapshot.className ?? scopeLabel}`,
      "",
      "Assigned-student attendance:",
      `- Present: ${snapshot.attendance.present}`,
      `- Absent: ${snapshot.attendance.absent}`,
      `- OD: ${snapshot.attendance.onDuty}`,
      `- Medical Leave: ${snapshot.attendance.medicalLeave}`,
      `- Not Marked: ${snapshot.attendance.notMarked}`,
      "",
      "Assigned-student exams:",
      `- Appeared: ${snapshot.exams.appearing}`,
      `- Absent: ${snapshot.exams.absent}`,
      `- Medical/OD: ${snapshot.exams.medicalLeave + snapshot.exams.onDuty}`,
      `- Pending/Unknown: ${snapshot.exams.pending}`,
      "",
      "Assigned-student risk and follow-up:",
      `- Critical: ${snapshot.academicRisk.critical}`,
      `- Recovering: ${snapshot.academicRisk.recovering}`,
      `- Intervention required: ${snapshot.academicRisk.interventionRequired}`,
      `- Parent follow-ups pending: ${snapshot.parentFollowUp.pending}`,
      `- Overdue interventions: ${snapshot.interventions.overdue}`,
    );
    if (snapshot.assignedStudentUpdates?.length) {
      lines.push("", "Assigned students requiring review:");
      for (const student of snapshot.assignedStudentUpdates) {
        lines.push(
          `- ${student.studentName} (${student.rollNumber}): attendance ${student.attendance}%; OD ${student.onDuty}; medical leave ${student.medicalLeave}; exam ${student.examStatus}; risk ${student.risk}${student.followUp ? `; follow-up: ${student.followUp}` : ""}`,
        );
      }
    }
  } else if (normalizedRole === "HOD") {
    lines.push(
      `Department: ${snapshot.department ?? scopeLabel}`,
      "",
      "Department attendance:",
      `- Present: ${snapshot.attendance.present}`,
      `- Absent: ${snapshot.attendance.absent}`,
      `- OD: ${snapshot.attendance.onDuty}`,
      `- Medical Leave: ${snapshot.attendance.medicalLeave}`,
      `- Exceptions: ${snapshot.attendance.exceptions}`,
      "",
      "Department exams:",
      `- Participated: ${snapshot.exams.appearing}`,
      `- Absent: ${snapshot.exams.absent}`,
      `- Medical/OD: ${snapshot.exams.medicalLeave + snapshot.exams.onDuty}`,
      `- Pending status: ${snapshot.exams.pending}`,
      ...snapshot.exams.summary.map((item) => `- ${item}`),
      "",
      "Department risk and response:",
      `- Critical students: ${snapshot.academicRisk.critical}`,
      `- New critical: ${snapshot.academicRisk.newCritical}`,
      `- Escalations: ${snapshot.escalations ?? snapshot.parentFollowUp.escalated}`,
      `- Parent follow-ups pending: ${snapshot.parentFollowUp.pending}`,
      `- Parent follow-ups escalated: ${snapshot.parentFollowUp.escalated}`,
      `- Interventions pending: ${snapshot.interventions.pending}`,
      `- Overdue interventions: ${snapshot.interventions.overdue}`,
      `- Recovered students: ${snapshot.interventions.recovered}`,
    );
  } else {
    lines.push(
      "Institution-wide summary:",
      "",
      "Attendance:",
      `- Present: ${snapshot.attendance.present}`,
      `- Absent: ${snapshot.attendance.absent}`,
      `- OD: ${snapshot.attendance.onDuty}`,
      `- Medical Leave: ${snapshot.attendance.medicalLeave}`,
      "",
      "Exams:",
      `- Participation: ${snapshot.exams.appearing}`,
      `- Absences: ${snapshot.exams.absent}`,
      `- Pending status: ${snapshot.exams.pending}`,
      "",
      "Institution risk and response:",
      `- Critical students: ${snapshot.academicRisk.critical}`,
      `- New critical: ${snapshot.academicRisk.newCritical}`,
      `- Escalations: ${snapshot.escalations ?? snapshot.parentFollowUp.escalated}`,
      `- Parent follow-ups pending: ${snapshot.parentFollowUp.pending}`,
      `- Parent follow-ups escalated: ${snapshot.parentFollowUp.escalated}`,
      `- Intervention cases pending: ${snapshot.interventions.pending}`,
      `- Overdue interventions: ${snapshot.interventions.overdue}`,
    );
    if (snapshot.departmentSummaries?.length) {
      lines.push("", "Department breakdown:");
      for (const department of snapshot.departmentSummaries) {
        lines.push(
          `- ${department.department}: present ${department.present}; absent ${department.absent}; OD ${department.onDuty}; medical leave ${department.medicalLeave}; exam participation ${department.examAppearing}; exam absences ${department.examAbsent}; critical ${department.criticalStudents}; escalations ${department.escalations}; parent follow-ups ${department.parentFollowUps}`,
        );
      }
    }
  }

  if (snapshot.actionItems?.length) {
    lines.push("", "Action required:", ...snapshot.actionItems.map((item) => `- ${item}`));
  }

  return { subject, body: lines.join("\n"), recipients };
}

export function buildImmediateAlertEmail(
  event: {
    studentName?: string;
    rollNumber?: string;
    department?: string;
    issue?: string;
    primaryFactors?: string[];
    recommendedAction?: string;
    generatedAt?: Date | string;
  },
): { subject: string; body: string } {
  const generatedAt = event.generatedAt ? new Date(event.generatedAt) : new Date();
  const primaryFactors = (event.primaryFactors ?? []).length > 0 ? event.primaryFactors! : ["Academic risk threshold exceeded."];
  const issueText = event.issue ?? "Critical academic risk";

  const lines = [
    "[Lumina AI] Critical Academic Alert — Action Required",
    "",
    "A critical academic event has been detected.",
    "",
    event.studentName ? `Student: ${event.studentName}` : "Student: Confidential",
    event.rollNumber ? `Roll Number: ${event.rollNumber}` : "Roll Number: Confidential",
    event.department ? `Department: ${event.department}` : "Department: Confidential",
    "",
    `Issue: ${issueText}`,
    "",
    "Primary factors:",
    ...primaryFactors.map((factor) => `- ${factor}`),
    "",
    `Recommended action: ${event.recommendedAction ?? "Mentor review required."}`,
    "",
    `Detected at: ${generatedAt.toISOString()}`,
  ];

  return {
    subject: `[Lumina AI] Critical Academic Alert — Action Required`,
    body: lines.join("\n"),
  };
}

export function roleLabel(role: AcademicRole): string {
  const labels: Record<AcademicRole, string> = {
    STUDENT: "Student",
    FACULTY: "Faculty",
    MENTOR: "Mentor",
    HOD: "HOD",
    ADMIN: "Admin",
  };
  return labels[role];
}

export function createEmailLogEntry(
  role: string | AcademicRole,
  recipients: AcademicRecipient[],
  emailType: "digest" | "alert",
  summary: string,
): {
  role: AcademicRole;
  recipients: string[];
  emailType: "digest" | "alert";
  summary: string;
  sentAt: string;
} {
  const normalizedRole = normalizeAcademicRole(role) ?? "ADMIN";
  return {
    role: normalizedRole,
    recipients: recipients.map((recipient) => recipient.email),
    emailType,
    summary,
    sentAt: new Date().toISOString(),
  };
}
