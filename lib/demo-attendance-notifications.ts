import { facultyStudents } from "@/lib/demo-data";
import type { DemoAttendanceStatus } from "@/lib/demo-model";
import type { FacultyStudent } from "@/lib/demo-data";
import { HOD_DEPARTMENT } from "@/lib/hod-data";

export const DEMO_ATTENDANCE_CLASS = "Demo Roll Register";

export const DEMO_FACULTY_COURSE_ASSIGNMENTS: Record<string, string[]> = {
  "faculty-demo-001": [...new Set(facultyStudents.map((student) => student.course))],
};

export const DEMO_ATTENDANCE_MENTOR_USER_ID = "mentor-demo-001";
export const DEMO_MENTOR_ROSTER_ASSIGNMENTS: Record<string, string> = {
  [DEMO_ATTENDANCE_MENTOR_USER_ID]: "Dr. Meera Shah",
};

export interface DemoCourseAttendance {
  studentId: number;
  course: string;
  status: DemoAttendanceStatus;
}

export interface DemoLeadershipContext {
  interventions: Array<{ student: string; status: string }>;
  escalatedStudentIds: number[];
  parentFollowUpStudentIds: number[];
  studentMetrics: Array<{
    studentId: number;
    assessmentAverage: number;
    riskCategory: "Critical" | "Moderate" | "Safe";
  }>;
}

export interface RoleAttendanceCounts {
  total: number;
  present: number;
  absent: number;
  od: number;
  medicalLeave: number;
}

export interface MentorAttendanceData {
  className: string;
  dateTime: string;
  counts: RoleAttendanceCounts;
  studentsByStatus: Record<DemoAttendanceStatus, string[]>;
}

export interface FacultyCourseData {
  course: string;
  className: string;
  counts: RoleAttendanceCounts;
  attendancePercentage: number;
  students: Array<{
    name: string;
    rollNo: string;
    status: DemoAttendanceStatus;
    marks: number;
  }>;
}

export interface LeadershipAttendanceData {
  department?: string;
  dateTime: string;
  attendance: RoleAttendanceCounts;
  departmentAttendance?: Array<{ department: string; counts: RoleAttendanceCounts }>;
  examParticipation: string;
  academicPerformance: { average: number; belowPassThreshold: number };
  risk: { critical: number; moderate: number; safe: number };
  interventions: { total: number; pending: number; completed: number; other: number };
  escalations: number;
  parentFollowUps: number;
}

const attendanceStatuses: DemoAttendanceStatus[] = ["Present", "Absent", "On Duty", "Medical Leave"];
type StudentAttendanceRecord = FacultyStudent & { attendanceStatus: DemoAttendanceStatus };

function getCourseAttendance(
  course: string,
  attendance: readonly DemoCourseAttendance[],
) {
  const statusByStudent = new Map(
    attendance.filter((record) => record.course === course).map((record) => [record.studentId, record.status]),
  );
  return facultyStudents
    .filter((student) => student.course === course)
    .map((student) => ({
      ...student,
      attendanceStatus: statusByStudent.get(student.id) ?? "Absent" as DemoAttendanceStatus,
    }));
}

function countStatuses(records: readonly { attendanceStatus: DemoAttendanceStatus }[]): RoleAttendanceCounts {
  return records.reduce<RoleAttendanceCounts>((counts, record) => {
    counts.total += 1;
    if (record.attendanceStatus === "Present") counts.present += 1;
    else if (record.attendanceStatus === "Absent") counts.absent += 1;
    else if (record.attendanceStatus === "On Duty") counts.od += 1;
    else counts.medicalLeave += 1;
    return counts;
  }, { total: 0, present: 0, absent: 0, od: 0, medicalLeave: 0 });
}

export function getMentorAttendanceData(
  mentorUserId: string,
  course: string,
  attendance: readonly DemoCourseAttendance[],
  dateTime: string,
): MentorAttendanceData {
  const assignedMentor = DEMO_MENTOR_ROSTER_ASSIGNMENTS[mentorUserId];
  const students = getCourseAttendance(course, attendance)
    .filter((student) => student.mentor === assignedMentor);
  const studentsByStatus = Object.fromEntries(attendanceStatuses.map((status) => [
    status,
    students.filter((student) => student.attendanceStatus === status).map((student) => student.name),
  ])) as Record<DemoAttendanceStatus, string[]>;

  return {
    className: DEMO_ATTENDANCE_CLASS,
    dateTime,
    counts: countStatuses(students),
    studentsByStatus,
  };
}

export function getFacultyCourseData(
  facultyUserId: string,
  course: string,
  attendance: readonly DemoCourseAttendance[],
): FacultyCourseData | null {
  if (!DEMO_FACULTY_COURSE_ASSIGNMENTS[facultyUserId]?.includes(course)) return null;
  const students = getCourseAttendance(course, attendance);
  const counts = countStatuses(students);
  return {
    course,
    className: DEMO_ATTENDANCE_CLASS,
    counts,
    attendancePercentage: counts.total
      ? Number(((counts.present + counts.od + counts.medicalLeave) / counts.total * 100).toFixed(1))
      : 0,
    students: students.map((student) => ({
      name: student.name,
      rollNo: student.rollNo,
      status: student.attendanceStatus,
      marks: student.subjectMarks[course] ?? student.assessmentAverage,
    })),
  };
}

function getLeadershipAttendanceData(
  roster: StudentAttendanceRecord[],
  leadership: DemoLeadershipContext,
  dateTime: string,
  department?: string,
): LeadershipAttendanceData {
  const counts = countStatuses(roster);
  const scopedIds = new Set(roster.map((student) => student.id));
  const scopedNames = new Set(roster.map((student) => student.name));
  const metricByStudent = new Map(leadership.studentMetrics.map((metric) => [metric.studentId, metric]));
  const performanceRecords = roster.map((student) => ({
    average: metricByStudent.get(student.id)?.assessmentAverage ?? student.assessmentAverage,
    category: metricByStudent.get(student.id)?.riskCategory ?? student.status,
  }));
  const scopedInterventions = leadership.interventions.filter((item) => scopedNames.has(item.student));
  const interventionSummary = {
    total: scopedInterventions.length,
    pending: scopedInterventions.filter((item) => item.status === "Scheduled").length,
    completed: scopedInterventions.filter((item) => item.status === "Completed").length,
    other: scopedInterventions.filter((item) => item.status !== "Scheduled" && item.status !== "Completed").length,
  };
  const departments = department
    ? undefined
    : [...new Set(roster.map((student) => student.department))].sort().map((name) => ({
      department: name,
      counts: countStatuses(roster.filter((student) => student.department === name)),
    }));

  return {
    ...(department ? { department } : {}),
    dateTime,
    attendance: counts,
    ...(departments ? { departmentAttendance: departments } : {}),
    examParticipation: "No exam participation records are available in the current demo data.",
    academicPerformance: {
      average: performanceRecords.length
        ? Number((performanceRecords.reduce((total, student) => total + student.average, 0) / performanceRecords.length).toFixed(1))
        : 0,
      belowPassThreshold: performanceRecords.filter((student) => student.average < 50).length,
    },
    risk: {
      critical: performanceRecords.filter((student) => student.category === "Critical").length,
      moderate: performanceRecords.filter((student) => student.category === "Moderate").length,
      safe: performanceRecords.filter((student) => student.category === "Safe").length,
    },
    interventions: interventionSummary,
    escalations: leadership.escalatedStudentIds.filter((id) => scopedIds.has(id)).length,
    parentFollowUps: leadership.parentFollowUpStudentIds.filter((id) => scopedIds.has(id)).length,
  };
}

export function getHODDepartmentData(
  attendance: readonly DemoCourseAttendance[],
  leadership: DemoLeadershipContext,
  dateTime: string,
): LeadershipAttendanceData {
  const statusByStudent = new Map(attendance.map((record) => [record.studentId, record.status]));
  const departmentRoster = facultyStudents.filter((student) => student.department === HOD_DEPARTMENT).map((student) => ({
    ...student,
    attendanceStatus: statusByStudent.get(student.id) ?? "Absent" as DemoAttendanceStatus,
  }));
  return getLeadershipAttendanceData(
    departmentRoster,
    leadership,
    dateTime,
    HOD_DEPARTMENT,
  );
}

export function getAdminInstitutionData(
  attendance: readonly DemoCourseAttendance[],
  leadership: DemoLeadershipContext,
  dateTime: string,
): LeadershipAttendanceData {
  const statusByStudent = new Map(attendance.map((record) => [record.studentId, record.status]));
  const fullInstitutionRoster = facultyStudents.map((student) => ({
    ...student,
    attendanceStatus: statusByStudent.get(student.id) ?? "Absent" as DemoAttendanceStatus,
  }));
  return getLeadershipAttendanceData(
    fullInstitutionRoster,
    leadership,
    dateTime,
  );
}

export function buildMentorAttendanceEmail(data: MentorAttendanceData): { subject: string; body: string } {
  const list = (students: string[]) => students.length ? students.map((student) => `- ${student}`).join("\n") : "None";
  return {
    subject: "[Lumina AI] Mentor Attendance Update",
    body: [
      "Mentor Attendance Update",
      `Date/time: ${data.dateTime}`,
      `Class/Section: ${data.className}`,
      "",
      "Attendance Summary:",
      `Present: ${data.counts.present}`,
      `Absent: ${data.counts.absent}`,
      `OD: ${data.counts.od}`,
      `Medical Leave: ${data.counts.medicalLeave}`,
      `Total assigned students: ${data.counts.total}`,
      "",
      "Present Students:",
      list(data.studentsByStatus.Present),
      "",
      "Absent Students:",
      list(data.studentsByStatus.Absent),
      "",
      "OD Students:",
      list(data.studentsByStatus["On Duty"]),
      "",
      "Medical Leave:",
      list(data.studentsByStatus["Medical Leave"]),
    ].join("\n"),
  };
}

export function buildFacultyCourseEmail(data: FacultyCourseData): { subject: string; body: string } {
  return {
    subject: `[Lumina AI] Faculty Course Update — ${data.course}`,
    body: [
      `Course: ${data.course}`,
      `Class/Section: ${data.className}`,
      `Attendance: Present ${data.counts.present}; Absent ${data.counts.absent}; OD ${data.counts.od}; Medical Leave ${data.counts.medicalLeave}`,
      `Attendance percentage: ${data.attendancePercentage}%`,
      "Exam participation: No exam records are available in the current demo data.",
      "Subject marks:",
      ...data.students.map((student) => `- ${student.name} (${student.rollNo}): ${student.marks}`),
    ].join("\n"),
  };
}

function buildLeadershipBody(data: LeadershipAttendanceData, audience: "HOD" | "ADMIN"): { subject: string; body: string } {
  const title = audience === "HOD" ? `HOD Department Update — ${data.department}` : "Admin Institution Update";
  return {
    subject: `[Lumina AI] ${title}`,
    body: [
      title,
      `Date/time: ${data.dateTime}`,
      ...(data.department ? [`Department: ${data.department}`] : []),
      "",
      "Attendance:",
      `Total students: ${data.attendance.total}`,
      `Present: ${data.attendance.present}`,
      `Absent: ${data.attendance.absent}`,
      `OD: ${data.attendance.od}`,
      `Medical Leave: ${data.attendance.medicalLeave}`,
      ...(data.departmentAttendance ? [
        "",
        "Department-wise attendance:",
        ...data.departmentAttendance.map(({ department, counts }) =>
          `- ${department}: Present ${counts.present}, Absent ${counts.absent}, OD ${counts.od}, Medical Leave ${counts.medicalLeave} (Total ${counts.total})`),
      ] : []),
      "",
      "Exam participation:",
      data.examParticipation,
      "",
      "Academic performance:",
      `Average: ${data.academicPerformance.average}%`,
      `Below 50%: ${data.academicPerformance.belowPassThreshold}`,
      "",
      "Risk summary:",
      `Critical: ${data.risk.critical}; Moderate: ${data.risk.moderate}; Safe: ${data.risk.safe}`,
      "",
      "Interventions:",
      `Total: ${data.interventions.total}; Pending: ${data.interventions.pending}; Completed: ${data.interventions.completed}; Other: ${data.interventions.other}`,
      `Escalations: ${data.escalations}`,
      `Parent follow-ups: ${data.parentFollowUps}`,
    ].join("\n"),
  };
}

export function buildHODDepartmentEmail(data: LeadershipAttendanceData): { subject: string; body: string } {
  return buildLeadershipBody(data, "HOD");
}

export function buildAdminInstitutionEmail(data: LeadershipAttendanceData): { subject: string; body: string } {
  return buildLeadershipBody(data, "ADMIN");
}
