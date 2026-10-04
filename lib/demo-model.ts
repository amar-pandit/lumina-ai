
import { attendanceData, courses, facultyStudents, recoveryTasks, studentProfile, type RecoveryTask } from "@/lib/demo-data";
import { DEMO_STUDENT, type DemoStudent } from "@/lib/student-demo-data";
import { calculateAttendance } from "@/lib/attendance-engine";
import { calculateRisk, DEFAULT_RISK_THRESHOLDS, DEFAULT_RISK_WEIGHTS, type RiskWeights, type RiskThresholds } from "@/lib/risk-engine";
import type { ParsedAttendanceRow } from "@/lib/voice-parser";
import { DEFAULT_LUMINA_CONFIG } from "@/lib/lumina-config";

export type DemoRole = "Student" | "Faculty" | "Mentor" | "HOD" | "Admin";
export type DemoAttendanceStatus = "Present" | "Absent" | "On Duty" | "Medical Leave";
export type DemoInterventionStatus = "Scheduled" | "Completed" | "Cancelled" | "No-show";

export interface DemoNotification {
  id: string;
  message: string;
  route: string;
  read: boolean;
}

export interface DemoSettings {
  attendanceMinimum: number;
  moderateRiskThreshold: number;
  criticalRiskThreshold: number;
  assessmentWeight: number;
  attendanceWeight: number;
  assignmentWeight: number;
  labWeight: number;
  velocityWeight: number;
  escalationSubjects: number;
  academicTerm: string;
  institutionName: string;
  notifyCriticalRisk: boolean;
  notifyAttendanceRisk: boolean;
  emailDigestEnabled: boolean;
  emailDigestSendOnlyOnChange: boolean;
  emailDigestCompactSummary: boolean;
  immediateCriticalAlertsEnabled: boolean;
  demoMode: boolean;
}

export type DemoEscalationStatus = "New" | "In Review" | "Actioned" | "Closed";

export interface DemoEscalationRecord {
  status: DemoEscalationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DemoParentContactRecord {
  status: "Pending" | "Sent";
  updatedAt: string;
}

export interface DemoGradeRecord {
  cia: number;
  midterm: number;
  lab: number;
  assignment: number;
}

export interface DemoIntervention {
  id: number;
  student: string;
  mentor: string;
  date: string;
  notes: string;
  type: string;
  status: DemoInterventionStatus;
}

export interface DemoState {
  role: DemoRole;
  term: string;
  notifications: DemoNotification[];
  dismissedNotificationIds: string[];
  settings: DemoSettings;
  attendanceSimulator: {
    totalClasses: number;
    classesAttended: number;
    futureClasses: number;
    futureAbsences: number;
  };
  attendanceByStudent: Record<number, DemoAttendanceStatus>;
  attendanceByCourse: Record<string, Record<number, DemoAttendanceStatus>>;
  gradebook: Record<number, DemoGradeRecord>;
  completedRecoveryTaskIds: number[];
  recoveryTasks: RecoveryTask[];
  completedCalendarItemIds: string[];
  reminderIds: string[];
  startedPrescriptionCodes: string[];
  escalatedStudentIds: number[];
  dispatchedParentIds: number[];
  escalationRecords: Record<number, DemoEscalationRecord>;
  parentContactRecords: Record<number, DemoParentContactRecord>;
  committedVoiceRows: ParsedAttendanceRow[];
  interventions: DemoIntervention[];
  remedialAssignments: Record<string, string>;
}

export function countsAsAttending(status: DemoAttendanceStatus) {
  return status === "Present" || status === "On Duty" || status === "Medical Leave";
}

export const DEMO_STATE_KEY = "lumina-demo-state";

export const DEMO_SETTINGS: DemoSettings = {
  attendanceMinimum: DEFAULT_LUMINA_CONFIG.risk.attendanceMinimum,
  moderateRiskThreshold: DEFAULT_LUMINA_CONFIG.risk.moderate,
  criticalRiskThreshold: DEFAULT_LUMINA_CONFIG.risk.critical,
  assessmentWeight: Math.round(DEFAULT_RISK_WEIGHTS.assessment * 100),
  attendanceWeight: Math.round(DEFAULT_RISK_WEIGHTS.attendance * 100),
  assignmentWeight: Math.round(DEFAULT_RISK_WEIGHTS.assignment * 100),
  labWeight: Math.round(DEFAULT_RISK_WEIGHTS.lab * 100),
  velocityWeight: Math.round(DEFAULT_RISK_WEIGHTS.velocity * 100),
  escalationSubjects: 3,
  academicTerm: "Fall 2026",
  institutionName: DEFAULT_LUMINA_CONFIG.institutionName,
  notifyCriticalRisk: true,
  notifyAttendanceRisk: true,
  emailDigestEnabled: DEFAULT_LUMINA_CONFIG.email.enabled,
  emailDigestSendOnlyOnChange: DEFAULT_LUMINA_CONFIG.email.sendOnlyOnChange,
  emailDigestCompactSummary: DEFAULT_LUMINA_CONFIG.email.compactSummaryWhenIdle,
  immediateCriticalAlertsEnabled: DEFAULT_LUMINA_CONFIG.email.immediateAlertsEnabled,
  demoMode: DEFAULT_LUMINA_CONFIG.demoMode,
};

export function normalizeDemoSettings(settings: Partial<DemoSettings> | null | undefined): DemoSettings {
  return { ...DEMO_SETTINGS, ...settings };
}

const initialAttendanceByStudent = Object.fromEntries(
  facultyStudents.map((student) => [
    student.id,
    student.attendance >= studentProfile.requiredAttendance ? "Present" : "Absent",
  ]),
) as Record<number, DemoAttendanceStatus>;

const initialGradebook = Object.fromEntries(
  facultyStudents.map((student) => {
    const demoStudent = student.id === 1;
    const componentScore = (
      DEMO_STUDENT.assessmentAverage -
      DEMO_STUDENT.labCompletion * 0.25 -
      DEMO_STUDENT.assignmentPerformance * 0.15
    ) / 0.6;
    return [student.id, {
      cia: demoStudent ? componentScore : Math.round(student.assessmentAverage * 0.85),
      midterm: demoStudent ? componentScore : student.assessmentAverage,
      lab: demoStudent ? DEMO_STUDENT.labCompletion : student.labCompletion,
      assignment: demoStudent ? DEMO_STUDENT.assignmentPerformance : student.assignmentCompletion,
    }];
  }),
) as Record<number, DemoGradeRecord>;

const initialInterventions: DemoIntervention[] = facultyStudents.slice(0, 4).map((student, index) => ({
  id: index + 1,
  student: student.name,
  mentor: student.mentor,
  date: `2026-10-${String(5 + index * 2).padStart(2, "0")}`,
  notes: `Review ${student.issue.toLowerCase()} and agree on a weekly action plan.`,
  type: index % 2 === 0 ? "Remedial session" : "Mentor check-in",
  status: index === 0 ? "Scheduled" : index === 1 ? "Completed" : index === 2 ? "No-show" : "Scheduled",
}));

export const INITIAL_DEMO_STATE: DemoState = {
  role: "Student",
  term: "Fall 2026",
  notifications: [
    { id: "attendance", message: "Attendance dropped below 75%", route: "/student/attendance", read: false },
    { id: "risk", message: "Data Structures risk increased", route: "/student/risk", read: false },
    { id: "recovery", message: "New recovery milestone available", route: "/student/recovery", read: true },
    { id: "intervention", message: "Faculty intervention scheduled", route: "/faculty/interventions", read: true },
  ],
  dismissedNotificationIds: [],
  settings: DEMO_SETTINGS,
  attendanceSimulator: {
    totalClasses: attendanceData.totalClasses,
    classesAttended: attendanceData.attendedClasses,
    futureClasses: 0,
    futureAbsences: 0,
  },
  attendanceByStudent: initialAttendanceByStudent,
  attendanceByCourse: {},
  gradebook: initialGradebook,
  completedRecoveryTaskIds: [],
  recoveryTasks,
  completedCalendarItemIds: [],
  reminderIds: ["dbms-a3", "attendance-75"],
  startedPrescriptionCodes: [],
  escalatedStudentIds: [],
  dispatchedParentIds: [],
  escalationRecords: {},
  parentContactRecords: {},
  committedVoiceRows: [],
  interventions: initialInterventions,
  remedialAssignments: {},
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function finiteValue(value: unknown, fallback: number, minimum = 0, maximum = 100): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

export function normalizeDemoState(value: unknown): DemoState {
  if (!isRecord(value)) return INITIAL_DEMO_STATE;

  const settingsValue = isRecord(value.settings) ? value.settings : {};
  const attendanceValue = isRecord(value.attendanceSimulator) ? value.attendanceSimulator : {};
  const settings = normalizeDemoSettings({
    attendanceMinimum: finiteValue(settingsValue.attendanceMinimum, DEMO_SETTINGS.attendanceMinimum, 1),
    moderateRiskThreshold: finiteValue(settingsValue.moderateRiskThreshold, DEMO_SETTINGS.moderateRiskThreshold),
    criticalRiskThreshold: finiteValue(settingsValue.criticalRiskThreshold, DEMO_SETTINGS.criticalRiskThreshold),
    assessmentWeight: finiteValue(settingsValue.assessmentWeight, DEMO_SETTINGS.assessmentWeight),
    attendanceWeight: finiteValue(settingsValue.attendanceWeight, DEMO_SETTINGS.attendanceWeight),
    assignmentWeight: finiteValue(settingsValue.assignmentWeight, DEMO_SETTINGS.assignmentWeight),
    labWeight: finiteValue(settingsValue.labWeight, DEMO_SETTINGS.labWeight),
    velocityWeight: finiteValue(settingsValue.velocityWeight, DEMO_SETTINGS.velocityWeight),
    escalationSubjects: finiteValue(settingsValue.escalationSubjects, DEMO_SETTINGS.escalationSubjects, 1, courses.length),
    academicTerm: typeof settingsValue.academicTerm === "string" ? settingsValue.academicTerm : DEMO_SETTINGS.academicTerm,
    institutionName: typeof settingsValue.institutionName === "string" ? settingsValue.institutionName : DEMO_SETTINGS.institutionName,
    notifyCriticalRisk: typeof settingsValue.notifyCriticalRisk === "boolean" ? settingsValue.notifyCriticalRisk : DEMO_SETTINGS.notifyCriticalRisk,
    notifyAttendanceRisk: typeof settingsValue.notifyAttendanceRisk === "boolean" ? settingsValue.notifyAttendanceRisk : DEMO_SETTINGS.notifyAttendanceRisk,
    emailDigestEnabled: typeof settingsValue.emailDigestEnabled === "boolean" ? settingsValue.emailDigestEnabled : DEMO_SETTINGS.emailDigestEnabled,
    emailDigestSendOnlyOnChange: typeof settingsValue.emailDigestSendOnlyOnChange === "boolean" ? settingsValue.emailDigestSendOnlyOnChange : DEMO_SETTINGS.emailDigestSendOnlyOnChange,
    emailDigestCompactSummary: typeof settingsValue.emailDigestCompactSummary === "boolean" ? settingsValue.emailDigestCompactSummary : DEMO_SETTINGS.emailDigestCompactSummary,
    immediateCriticalAlertsEnabled: typeof settingsValue.immediateCriticalAlertsEnabled === "boolean" ? settingsValue.immediateCriticalAlertsEnabled : DEMO_SETTINGS.immediateCriticalAlertsEnabled,
    demoMode: typeof settingsValue.demoMode === "boolean" ? settingsValue.demoMode : DEMO_SETTINGS.demoMode,
  });
  const validStatuses: readonly DemoAttendanceStatus[] = ["Present", "Absent", "On Duty", "Medical Leave"];
  const attendanceByStudent: DemoState["attendanceByStudent"] = { ...INITIAL_DEMO_STATE.attendanceByStudent };
  const attendanceByCourse: DemoState["attendanceByCourse"] = {};
  if (isRecord(value.attendanceByStudent)) {
    for (const [id, status] of Object.entries(value.attendanceByStudent)) {
      if (/^\d+$/.test(id) && typeof status === "string" && validStatuses.includes(status as DemoAttendanceStatus)) {
        attendanceByStudent[Number(id)] = status as DemoAttendanceStatus;
      }
    }
  }
  if (isRecord(value.attendanceByCourse)) {
    for (const [course, courseAttendance] of Object.entries(value.attendanceByCourse)) {
      if (!isRecord(courseAttendance)) continue;
      attendanceByCourse[course] = {};
      for (const [id, status] of Object.entries(courseAttendance)) {
        if (/^\d+$/.test(id) && typeof status === "string" && validStatuses.includes(status as DemoAttendanceStatus)) {
          attendanceByCourse[course][Number(id)] = status as DemoAttendanceStatus;
        }
      }
    }
  }
  const gradebook: DemoState["gradebook"] = { ...INITIAL_DEMO_STATE.gradebook };
  if (isRecord(value.gradebook)) {
    for (const [id, record] of Object.entries(value.gradebook)) {
      if (!/^\d+$/.test(id) || !isRecord(record)) continue;
      const fields = ["cia", "midterm", "lab", "assignment"] as const;
      if (!fields.every((field) => typeof record[field] === "number" && Number.isFinite(record[field]))) continue;
      gradebook[Number(id)] = {
        cia: finiteValue(record.cia, 0),
        midterm: finiteValue(record.midterm, 0),
        lab: finiteValue(record.lab, 0),
        assignment: finiteValue(record.assignment, 0),
      };
    }
  }
  const notificationsValue = Array.isArray(value.notifications)
    ? value.notifications.filter((item): item is DemoNotification => isRecord(item)
      && typeof item.id === "string"
      && typeof item.message === "string"
      && typeof item.route === "string"
      && typeof item.read === "boolean")
    : [];
  const notifications = notificationsValue.length > 0 ? notificationsValue : INITIAL_DEMO_STATE.notifications;
  const interventionStatuses: readonly DemoInterventionStatus[] = ["Scheduled", "Completed", "Cancelled", "No-show"];
  const interventionsValue = Array.isArray(value.interventions)
    ? value.interventions.filter((item): item is DemoIntervention => isRecord(item)
      && typeof item.id === "number"
      && Number.isFinite(item.id)
      && typeof item.student === "string"
      && typeof item.mentor === "string"
      && typeof item.date === "string"
      && typeof item.notes === "string"
      && typeof item.type === "string"
      && typeof item.status === "string"
      && interventionStatuses.includes(item.status as DemoInterventionStatus))
    : [];
  const interventions = interventionsValue.length > 0 ? interventionsValue : INITIAL_DEMO_STATE.interventions;
  const escalationStatuses: readonly DemoEscalationStatus[] = ["New", "In Review", "Actioned", "Closed"];
  const escalationRecords = isRecord(value.escalationRecords)
    ? Object.fromEntries(Object.entries(value.escalationRecords).flatMap(([id, record]) => (
      /^\d+$/.test(id) && isRecord(record)
      && typeof record.status === "string"
      && escalationStatuses.includes(record.status as DemoEscalationStatus)
      && typeof record.createdAt === "string"
      && typeof record.updatedAt === "string"
        ? [[id, { status: record.status as DemoEscalationStatus, createdAt: record.createdAt, updatedAt: record.updatedAt }]]
        : []
    )))
    : {};
  const parentContactRecords: DemoState["parentContactRecords"] = {};
  if (isRecord(value.parentContactRecords)) {
    for (const [id, record] of Object.entries(value.parentContactRecords)) {
      if (/^\d+$/.test(id) && isRecord(record)
        && (record.status === "Pending" || record.status === "Sent")
        && typeof record.updatedAt === "string") {
        parentContactRecords[Number(id)] = { status: record.status, updatedAt: record.updatedAt };
      }
    }
  }
  const recoveryTasksValue = Array.isArray(value.recoveryTasks)
    ? value.recoveryTasks.filter((item): item is RecoveryTask => isRecord(item)
      && typeof item.id === "number"
      && typeof item.title === "string"
      && typeof item.duration === "string"
      && ["High", "Medium", "Low"].includes(String(item.priority))
      && typeof item.day === "string")
    : [];
  const numericIds = (candidate: unknown, fallback: number[]) => Array.isArray(candidate)
    ? candidate.filter((item): item is number => typeof item === "number" && Number.isFinite(item))
    : fallback;
  const stringIds = (candidate: unknown, fallback: string[]) => Array.isArray(candidate)
    ? candidate.filter((item): item is string => typeof item === "string")
    : fallback;
  const stringRecord = (candidate: unknown, fallback: Record<string, string>) => isRecord(candidate)
    ? Object.fromEntries(Object.entries(candidate).filter((entry): entry is [string, string] => typeof entry[1] === "string"))
    : fallback;

  return {
    ...INITIAL_DEMO_STATE,
    role: ["Student", "Faculty", "Mentor", "HOD", "Admin"].includes(String(value.role))
      ? value.role as DemoRole
      : INITIAL_DEMO_STATE.role,
    term: typeof value.term === "string" ? value.term : INITIAL_DEMO_STATE.term,
    notifications,
    dismissedNotificationIds: stringIds(value.dismissedNotificationIds, []),
    settings,
    attendanceSimulator: {
      totalClasses: finiteValue(attendanceValue.totalClasses, INITIAL_DEMO_STATE.attendanceSimulator.totalClasses, 1),
      classesAttended: finiteValue(attendanceValue.classesAttended, INITIAL_DEMO_STATE.attendanceSimulator.classesAttended),
      futureClasses: finiteValue(attendanceValue.futureClasses, INITIAL_DEMO_STATE.attendanceSimulator.futureClasses),
      futureAbsences: finiteValue(attendanceValue.futureAbsences, INITIAL_DEMO_STATE.attendanceSimulator.futureAbsences),
    },
    attendanceByStudent,
    attendanceByCourse,
    gradebook,
    completedRecoveryTaskIds: numericIds(value.completedRecoveryTaskIds, []),
    recoveryTasks: recoveryTasksValue.length > 0 ? recoveryTasksValue : INITIAL_DEMO_STATE.recoveryTasks,
    completedCalendarItemIds: stringIds(value.completedCalendarItemIds, []),
    reminderIds: stringIds(value.reminderIds, []),
    startedPrescriptionCodes: stringIds(value.startedPrescriptionCodes, []),
    escalatedStudentIds: numericIds(value.escalatedStudentIds, []),
    dispatchedParentIds: numericIds(value.dispatchedParentIds, []),
    escalationRecords,
    parentContactRecords,
    committedVoiceRows: Array.isArray(value.committedVoiceRows) ? value.committedVoiceRows.filter((item): item is ParsedAttendanceRow => isRecord(item)
      && typeof item.roll === "number"
      && Number.isFinite(item.roll)
      && ["Present", "Absent", "On Duty", "Medical Leave", "Scored", "EXCLUDED"].includes(String(item.status))
      && (item.score === null || typeof item.score === "number" && Number.isFinite(item.score))
      && (item.scoreMaximum === null || typeof item.scoreMaximum === "number" && Number.isFinite(item.scoreMaximum))
      && typeof item.confidence === "number"
      && Number.isFinite(item.confidence)) : [],
    interventions,
    remedialAssignments: stringRecord(value.remedialAssignments, {}),
  };
}

export function riskWeightsFromSettings(settings: DemoSettings): RiskWeights {
  const applied = normalizeDemoSettings(settings);
  return {
    attendance: applied.attendanceWeight / 100,
    assessment: applied.assessmentWeight / 100,
    assignment: applied.assignmentWeight / 100,
    lab: applied.labWeight / 100,
    velocity: applied.velocityWeight / 100,
  };
}

export function riskThresholdsFromSettings(settings: DemoSettings): RiskThresholds {
  const applied = normalizeDemoSettings(settings);
  return {
    ...DEFAULT_RISK_THRESHOLDS,
    attendanceMinimum: applied.attendanceMinimum,
    moderate: applied.moderateRiskThreshold,
    critical: applied.criticalRiskThreshold,
  };
}

export function getDemoRoster(state: DemoState) {
  return facultyStudents.map((student) => {
    const defaultAttendance = initialAttendanceByStudent[student.id];
    const currentAttendance = state.attendanceByStudent[student.id] ?? defaultAttendance;
    const statusDelta = Number(countsAsAttending(currentAttendance))
      - Number(countsAsAttending(defaultAttendance));
    const attendance = student.id === 1
      ? getSimulatorAttendance(state).currentAttendance
      : Math.max(0, Math.min(100, student.attendance + statusDelta * 2));
    const grades = state.gradebook[student.id] ?? initialGradebook[student.id];
    const academicPerformance = grades.cia * 0.3 + grades.midterm * 0.3 + grades.lab * 0.25 + grades.assignment * 0.15;
    const risk = calculateRisk({
      attendance,
      assessmentAverage: academicPerformance,
      academicVelocity: student.velocity,
      assignmentPerformance: grades.assignment,
      labCompletion: grades.lab,
    }, riskWeightsFromSettings(state.settings), riskThresholdsFromSettings(state.settings));
    const subjectMarks = Object.fromEntries(courses.map((course) => {
      const originalScore = student.subjectMarks[course.name] ?? student.assessmentAverage;
      const score = Math.max(0, Math.min(100, academicPerformance + originalScore - student.assessmentAverage));
      return [course.name, Number(score.toFixed(1))];
    }));
    const criticalSubjects = courses.filter((course) => calculateRisk({
      attendance,
      assessmentAverage: subjectMarks[course.name] ?? academicPerformance,
      academicVelocity: student.velocity,
      assignmentPerformance: grades.assignment,
      labCompletion: grades.lab,
    }, riskWeightsFromSettings(state.settings), riskThresholdsFromSettings(state.settings)).category === "CRITICAL").map((course) => course.name);
    const primaryFactor = [...risk.factors].sort((left, right) => right.contribution - left.contribution)[0];

    return {
      ...student,
      attendance,
      assessmentAverage: Math.round(academicPerformance),
      risk: risk.score,
      status: risk.category === "CRITICAL" ? "Critical" as const : risk.category === "MODERATE" ? "Moderate" as const : "Safe" as const,
      issue: primaryFactor?.name ?? student.issue,
      riskDrivers: risk.factors.filter((factor) => factor.contribution >= 10).map((factor) => factor.name),
      continuousAssessmentFailures: academicPerformance < 45 ? 2 : academicPerformance < 55 ? 1 : 0,
      criticalSubjects,
      subjectMarks,
      courseRisk: risk,
    };
  });
}

export function getStudentProfile(state: DemoState, studentId = DEMO_STUDENT.id): DemoStudent {
  if (studentId !== DEMO_STUDENT.id) {
    throw new Error(`No student demo data configured for student ID ${studentId}.`);
  }

  const grades = state.gradebook[1] ?? initialGradebook[1];
  const assessmentAverage = grades.cia * 0.3 + grades.midterm * 0.3 + grades.lab * 0.25 + grades.assignment * 0.15;

  return {
    ...DEMO_STUDENT,
    totalClasses: state.attendanceSimulator.totalClasses,
    attendedClasses: state.attendanceSimulator.classesAttended,
    attendance: getSimulatorAttendance(state).currentAttendance,
    assessmentAverage: Number(assessmentAverage.toFixed(1)),
    assignmentPerformance: grades.assignment,
    labCompletion: grades.lab,
    subjectWiseMarks: DEMO_STUDENT.subjectWiseMarks.map((subject, index) => (
      index === 0 ? { ...subject, score: Number(assessmentAverage.toFixed(1)) } : subject
    )),
  };
}

export function getStudentRisk(state: DemoState, studentId = DEMO_STUDENT.id) {
  const student = getStudentProfile(state, studentId);
  return calculateRisk({
    attendance: student.attendance,
    assessmentAverage: student.assessmentAverage,
    academicVelocity: student.academicVelocity,
    assignmentPerformance: student.assignmentPerformance,
    labCompletion: student.labCompletion,
  }, riskWeightsFromSettings(state.settings), riskThresholdsFromSettings(state.settings));
}

export function getSimulatorAttendance(state: DemoState) {
  return calculateAttendance({
    totalClasses: state.attendanceSimulator.totalClasses,
    attendedClasses: state.attendanceSimulator.classesAttended,
    futureClasses: state.attendanceSimulator.futureClasses,
    futureAbsences: state.attendanceSimulator.futureAbsences,
    requiredAttendance: state.settings.attendanceMinimum,
  });
}

export function getRecoveryTasks(state: DemoState) {
  return state.recoveryTasks;
}

export const RECOVERY_TASK_IDS = recoveryTasks.map((task) => task.id);
