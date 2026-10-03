import { courses, type FacultyStudent } from "@/lib/demo-data";
import {
  normalizeDemoSettings,
  type DemoEscalationStatus,
  type DemoState,
} from "@/lib/demo-model";
import { calculateRisk, type RiskCategory, type RiskResult } from "@/lib/risk-engine";

export interface CourseStudent {
  student: FacultyStudent;
  assessment: number;
  risk: RiskResult;
}

export interface DepartmentCourseAnalytics {
  department: string;
  course: string;
  totalStudents: number;
  averageAttendance: number;
  averageAssessment: number;
  atRiskStudents: number;
  criticalStudents: number;
  recoveryProgress: number;
  students: CourseStudent[];
}

export interface EscalationCandidate {
  student: FacultyStudent;
  criticalSubjects: string[];
  status: DemoEscalationStatus;
  createdAt: string;
}

export function getCourseStudent(student: FacultyStudent, course: string, state: DemoState): CourseStudent {
  const assessment = student.subjectMarks[course] ?? student.assessmentAverage;
  const settings = normalizeDemoSettings(state.settings);
  const risk = calculateRisk({
    attendance: student.attendance,
    assessmentAverage: assessment,
    academicVelocity: student.velocity,
    assignmentPerformance: student.assignmentCompletion,
    labCompletion: student.labCompletion,
  }, {
    attendance: settings.attendanceWeight / 100,
    assessment: settings.assessmentWeight / 100,
    assignment: settings.assignmentWeight / 100,
    lab: settings.labWeight / 100,
    velocity: settings.velocityWeight / 100,
  }, {
    attendanceMinimum: settings.attendanceMinimum,
    moderate: settings.moderateRiskThreshold,
    critical: settings.criticalRiskThreshold,
  });
  return { student, assessment, risk };
}

export function getDepartmentCourseAnalytics(
  roster: FacultyStudent[],
  state: DemoState,
): DepartmentCourseAnalytics[] {
  const departments = [...new Set(roster.map((student) => student.department))];
  return departments.flatMap((department) => courses.map((course) => {
    const students = roster
      .filter((student) => student.department === department)
      .map((student) => getCourseStudent(student, course.name, state));
    const totalStudents = students.length;
    const recoveringNames = new Set(state.interventions
      .filter((intervention) => intervention.status === "Completed")
      .map((intervention) => intervention.student));
    const recovered = students.filter(({ student }) => recoveringNames.has(student.name)).length;
    const average = (selector: (item: CourseStudent) => number) => (
      totalStudents === 0 ? 0 : students.reduce((total, item) => total + selector(item), 0) / totalStudents
    );

    return {
      department,
      course: course.name,
      totalStudents,
      averageAttendance: Number(average((item) => item.student.attendance).toFixed(1)),
      averageAssessment: Number(average((item) => item.assessment).toFixed(1)),
      atRiskStudents: students.filter((item) => item.risk.category !== "SAFE").length,
      criticalStudents: students.filter((item) => item.risk.category === "CRITICAL").length,
      recoveryProgress: totalStudents === 0 ? 0 : Math.round((recovered / totalStudents) * 100),
      students,
    };
  }));
}

export function getEscalationCandidates(roster: FacultyStudent[], state: DemoState): EscalationCandidate[] {
  const settings = normalizeDemoSettings(state.settings);
  return roster.flatMap((student) => {
    const criticalSubjects = courses.filter((course) => (
      getCourseStudent(student, course.name, state).risk.category === "CRITICAL"
    )).map((course) => course.name);
    if (criticalSubjects.length < settings.escalationSubjects) return [];

    const record = state.escalationRecords?.[student.id];
    return [{
      student,
      criticalSubjects,
      status: record?.status ?? "New",
      createdAt: record?.createdAt ?? "",
    }];
  });
}

export function escalationStatusTone(status: DemoEscalationStatus): "neutral" | "warning" | "success" | "critical" {
  if (status === "Closed") return "neutral";
  if (status === "In Review") return "warning";
  if (status === "Actioned") return "success";
  return "critical";
}

export function parentCommunicationTrigger(
  student: FacultyStudent,
  state: DemoState,
): string | null {
  const settings = normalizeDemoSettings(state.settings);
  if (settings.notifyCriticalRisk && student.status === "Critical") return "Critical academic risk";
  if (settings.notifyAttendanceRisk && student.attendance < settings.attendanceMinimum) {
    return `Attendance below ${settings.attendanceMinimum}%`;
  }
  if (student.continuousAssessmentFailures >= 2) return "Multiple assessment failures";
  return null;
}

export function riskCategoryLabel(category: RiskCategory) {
  if (category === "CRITICAL") return "Critical";
  if (category === "MODERATE") return "Moderate";
  return "Safe";
}
