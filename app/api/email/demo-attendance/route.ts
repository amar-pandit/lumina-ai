import { getCurrentUser } from "@/lib/auth";
import { facultyStudents } from "@/lib/demo-data";
import type { DemoAttendanceStatus } from "@/lib/demo-model";
import {
  DEMO_ATTENDANCE_CLASS,
  DEMO_ATTENDANCE_MENTOR_USER_ID,
  DEMO_FACULTY_COURSE_ASSIGNMENTS,
  type DemoCourseAttendance,
  type DemoLeadershipContext,
  getAdminInstitutionData,
  getFacultyCourseData,
  getHODDepartmentData,
  getMentorAttendanceData,
} from "@/lib/demo-attendance-notifications";
import { sendDemoAttendanceNotification } from "@/lib/email-service";

export const runtime = "nodejs";

interface AttendanceNotificationRequest {
  course: string;
  attendance: DemoCourseAttendance[];
  leadership: DemoLeadershipContext;
}

const attendanceStatuses: readonly DemoAttendanceStatus[] = ["Present", "Absent", "On Duty", "Medical Leave"];
const riskCategories = ["Critical", "Moderate", "Safe"] as const;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIdList(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.every((id) => typeof id === "number" && Number.isInteger(id) && id > 0);
}

function isNotificationRequest(value: unknown): value is AttendanceNotificationRequest {
  if (!isObject(value) || typeof value.course !== "string" || !Array.isArray(value.attendance)
    || !isObject(value.leadership)) return false;

  const attendanceIsValid = value.attendance.every((entry) =>
    isObject(entry)
    && typeof entry.studentId === "number"
    && Number.isInteger(entry.studentId)
    && typeof entry.course === "string"
    && typeof entry.status === "string"
    && attendanceStatuses.includes(entry.status as DemoAttendanceStatus));
  const leadership = value.leadership;
  const studentMetrics = leadership.studentMetrics;
  const metricsValid = Array.isArray(studentMetrics)
    && studentMetrics.length === facultyStudents.length
    && studentMetrics.every((metric) =>
      isObject(metric)
      && typeof metric.studentId === "number"
      && Number.isInteger(metric.studentId)
      && typeof metric.assessmentAverage === "number"
      && Number.isFinite(metric.assessmentAverage)
      && metric.assessmentAverage >= 0
      && metric.assessmentAverage <= 100
      && typeof metric.riskCategory === "string"
      && riskCategories.includes(metric.riskCategory as (typeof riskCategories)[number]));
  const interventionsValid = Array.isArray(leadership.interventions)
    && leadership.interventions.every((item) =>
      isObject(item)
      && typeof item.student === "string"
      && typeof item.status === "string");

  return typeof value.course === "string"
    && value.course.length > 0
    && value.course.length <= 120
    && value.attendance.length === facultyStudents.length
    && attendanceIsValid
    && metricsValid
    && interventionsValid
    && isIdList(leadership.escalatedStudentIds)
    && isIdList(leadership.parentFollowUpStudentIds);
}

function hasUniqueAndCompleteRoster(attendance: readonly DemoCourseAttendance[]): boolean {
  const attendanceById = new Map(attendance.map((entry) => [entry.studentId, entry]));
  return attendanceById.size === facultyStudents.length
    && facultyStudents.every((student) => attendanceById.get(student.id)?.course === student.course);
}

function hasUniqueAndCompleteMetrics(metrics: DemoLeadershipContext["studentMetrics"]): boolean {
  const metricById = new Map(metrics.map((metric) => [metric.studentId, metric]));
  return metricById.size === facultyStudents.length
    && facultyStudents.every((student) => metricById.has(student.id));
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  const session = await getCurrentUser();
  if (!session) return Response.json({ error: "Please sign in again." }, { status: 401 });
  if (session.role !== "FACULTY") {
    return Response.json({ error: "Only Faculty can send demo course attendance notifications." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "A valid attendance summary is required." }, { status: 400 });
  }
  if (!isNotificationRequest(body)
    || !DEMO_FACULTY_COURSE_ASSIGNMENTS[session.user.id]?.includes(body.course)
    || !hasUniqueAndCompleteRoster(body.attendance)
    || !hasUniqueAndCompleteMetrics(body.leadership.studentMetrics)) {
    return Response.json({ error: "The course attendance summary is invalid or outside your assignments." }, { status: 400 });
  }

  const facultyCourseData = getFacultyCourseData(session.user.id, body.course, body.attendance);
  if (!facultyCourseData) {
    return Response.json({ error: "You are not assigned to this course." }, { status: 403 });
  }

  const timestamp = new Date().toISOString();
  const leadership = body.leadership;
  let result: Awaited<ReturnType<typeof sendDemoAttendanceNotification>>;
  try {
    result = await sendDemoAttendanceNotification({
      course: body.course,
      className: DEMO_ATTENDANCE_CLASS,
      updatedBy: session.user.name,
      timestamp,
      mentor: getMentorAttendanceData(DEMO_ATTENDANCE_MENTOR_USER_ID, body.course, body.attendance, timestamp),
      hod: getHODDepartmentData(body.attendance, leadership, timestamp),
      admin: getAdminInstitutionData(body.attendance, leadership, timestamp),
    });
  } catch (error) {
    console.error("Demo attendance email service failed.", error instanceof Error ? error.name : "Unknown error");
    return Response.json({ success: false, errorMessage: "The demo attendance email service failed." }, {
      status: 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const success = result.deliveries.every((delivery) => delivery.status === "SENT");
  return Response.json({
    success,
    eventId: result.eventId,
    deliveries: result.deliveries,
  }, {
    status: success ? 200 : 502,
    headers: { "Cache-Control": "private, no-store" },
  });
}
