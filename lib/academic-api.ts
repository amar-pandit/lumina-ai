import "server-only";

import {
  AttendanceStatus,
  ExamStatus,
  NotificationEventType,
  Prisma,
} from "@prisma/client";
import type { DemoSession } from "@/lib/auth-types";
import {
  canAccessCourse,
  canAccessDepartment,
  canManageStudent,
  studentScopeWhere,
} from "@/lib/academic-authorization";
import { refreshOneStudentRisk, refreshRiskSnapshots } from "@/lib/db-risk-engine";
import { prisma } from "@/lib/prisma";

export type AcademicResource =
  | "students"
  | "attendance"
  | "marks"
  | "exams"
  | "risk"
  | "interventions"
  | "parent-followups"
  | "departments"
  | "notification-events"
  | "email-history";

const attendanceStatuses = new Set<string>(Object.values(AttendanceStatus));
const examStatuses = new Set<string>(Object.values(ExamStatus));

export async function hasDatabaseRole(session: DemoSession): Promise<boolean> {
  if (!process.env.DATABASE_URL?.trim()) return false;
  return Boolean(await prisma.user.findFirst({
    where: {
      id: session.user.id,
      isActive: true,
      roles: { some: { role: { name: session.role } } },
    },
    select: { id: true },
  }));
}

function jsonError(message: string, status: number): Response {
  return Response.json({ error: message }, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown> | Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return jsonError("Request body must be an object.", 400);
  }
  return body as Record<string, unknown>;
}

function isResponse(value: unknown): value is Response {
  return value instanceof Response;
}

function validString(body: Record<string, unknown>, name: string): string | null {
  const value = body[name];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

async function listStudents(session: DemoSession) {
  return prisma.student.findMany({
    where: studentScopeWhere(session),
    take: 500,
    orderBy: [{ department: { name: "asc" } }, { rollNumber: "asc" }],
    select: {
      id: true,
      externalId: true,
      name: true,
      rollNumber: true,
      year: true,
      isDemo: true,
      department: { select: { id: true, code: true, name: true } },
      classGroup: { select: { id: true, name: true } },
      riskSnapshots: {
        take: 1,
        orderBy: { calculatedAt: "desc" },
        select: { score: true, category: true, calculatedAt: true },
      },
    },
  });
}

async function listAttendance(session: DemoSession) {
  return prisma.attendanceRecord.findMany({
    where: { student: studentScopeWhere(session) },
    take: 2000,
    orderBy: { recordedAt: "desc" },
    include: {
      session: {
        select: {
          sessionDate: true,
          label: true,
          course: { select: { code: true, name: true } },
        },
      },
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          department: { select: { code: true, name: true } },
        },
      },
    },
  });
}

async function listMarks(session: DemoSession) {
  return prisma.grade.findMany({
    where: { student: studentScopeWhere(session) },
    take: 3000,
    orderBy: [{ term: "desc" }, { recordedAt: "desc" }],
    include: {
      course: { select: { code: true, name: true } },
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          department: { select: { code: true, name: true } },
        },
      },
    },
  });
}

function examWhere(session: DemoSession): Prisma.ExamWhereInput {
  if (session.role === "ADMIN") return {};
  if (session.role === "HOD") return { department: { headUserId: session.user.id } };
  if (session.role === "FACULTY") {
    return { course: { faculty: { some: { faculty: { userId: session.user.id } } } } };
  }
  if (session.role === "STUDENT") {
    return { participations: { some: { student: { authUserId: session.user.id } } } };
  }
  return { participations: { some: { student: studentScopeWhere(session) } } };
}

async function listExams(session: DemoSession) {
  return prisma.exam.findMany({
    where: examWhere(session),
    take: 500,
    orderBy: { scheduledAt: "desc" },
    include: {
      department: { select: { id: true, code: true, name: true } },
      course: { select: { id: true, code: true, name: true } },
      participations: {
        where: { student: studentScopeWhere(session) },
        include: {
          student: { select: { id: true, name: true, rollNumber: true } },
        },
      },
    },
  });
}

async function listRiskSnapshots(session: DemoSession) {
  return refreshRiskSnapshots(session);
}

async function listInterventions(session: DemoSession) {
  return prisma.intervention.findMany({
    where: { student: studentScopeWhere(session) },
    take: 1000,
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });
}

async function listParentFollowUps(session: DemoSession) {
  return prisma.parentFollowUp.findMany({
    where: { student: studentScopeWhere(session) },
    take: 1000,
    orderBy: [{ urgent: "desc" }, { dueAt: "asc" }, { createdAt: "desc" }],
    include: {
      student: {
        select: {
          id: true,
          name: true,
          rollNumber: true,
          department: { select: { id: true, name: true } },
        },
      },
    },
  });
}

async function listDepartments(session: DemoSession) {
  if (session.role === "ADMIN") {
    return prisma.department.findMany({
      take: 200,
      orderBy: { name: "asc" },
      include: { _count: { select: { students: true, courses: true } } },
    });
  }
  const students = await prisma.student.findMany({
    where: studentScopeWhere(session),
    select: { departmentId: true },
    distinct: ["departmentId"],
  });
  return prisma.department.findMany({
    where: { id: { in: students.map((student) => student.departmentId) } },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true, courses: true } } },
  });
}

function notificationWhere(session: DemoSession): Prisma.NotificationEventWhereInput {
  if (session.role === "ADMIN") return {};
  if (session.role === "HOD") return { department: { headUserId: session.user.id } };
  if (session.role === "STUDENT") {
    return { OR: [{ targetUserId: session.user.id }, { student: { authUserId: session.user.id } }] };
  }
  return {
    OR: [
      { targetUserId: session.user.id },
      { student: studentScopeWhere(session) },
    ],
  };
}

async function listNotificationEvents(session: DemoSession) {
  return prisma.notificationEvent.findMany({
    where: notificationWhere(session),
    take: 500,
    orderBy: { occurredAt: "desc" },
    include: {
      department: { select: { code: true, name: true } },
      student: { select: { id: true, name: true, rollNumber: true } },
    },
  });
}

async function listEmailHistory(session: DemoSession) {
  if (session.role !== "ADMIN") return jsonError("Only Admin can view email history.", 403);
  const entries = await prisma.emailHistory.findMany({
    take: 100,
    orderBy: { createdAt: "desc" },
    select: {
      status: true,
      kind: true,
      recipient: true,
      recipientRole: true,
      subject: true,
      errorMessage: true,
      attempt: true,
      createdAt: true,
      sentAt: true,
    },
  });
  return entries.map((entry) => ({
    status: entry.status,
    kind: entry.kind,
    recipient: entry.recipient,
    role: entry.recipientRole,
    subject: entry.subject,
    errorMessage: entry.errorMessage ?? undefined,
    attempt: entry.attempt,
    timestamp: (entry.sentAt ?? entry.createdAt).toISOString(),
  }));
}

async function createAttendance(session: DemoSession, body: Record<string, unknown>) {
  if (!["FACULTY", "HOD", "ADMIN"].includes(session.role)) {
    return jsonError("This role cannot record attendance.", 403);
  }
  const studentId = validString(body, "studentId");
  const courseId = validString(body, "courseId");
  const sessionDate = parseDate(body.sessionDate);
  const status = typeof body.status === "string" ? body.status : "";
  if (!studentId || !courseId || !sessionDate || !attendanceStatuses.has(status)) {
    return jsonError("A valid studentId, courseId, sessionDate, and attendance status are required.", 400);
  }

  const [authorizedStudent, courseAllowed, enrollment] = await Promise.all([
    canManageStudent(session, studentId),
    canAccessCourse(session, courseId),
    prisma.enrollment.findFirst({ where: { studentId, courseId, isActive: true }, select: { classGroupId: true } }),
  ]);
  if (!authorizedStudent || !courseAllowed || !enrollment?.classGroupId) {
    return jsonError("Student or course is outside your authorized academic scope.", 403);
  }

  const normalizedDate = new Date(Date.UTC(sessionDate.getUTCFullYear(), sessionDate.getUTCMonth(), sessionDate.getUTCDate()));
  const label = typeof body.label === "string" ? body.label.trim().slice(0, 100) : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;
  const result = await prisma.$transaction(async (tx) => {
    const attendanceSession = await tx.attendanceSession.upsert({
      where: {
        courseId_classGroupId_sessionDate: {
          courseId,
          classGroupId: enrollment.classGroupId!,
          sessionDate: normalizedDate,
        },
      },
      update: { label, markedByUserId: session.user.id },
      create: {
        courseId,
        classGroupId: enrollment.classGroupId!,
        sessionDate: normalizedDate,
        label,
        markedByUserId: session.user.id,
      },
    });
    const record = await tx.attendanceRecord.upsert({
      where: { sessionId_studentId: { sessionId: attendanceSession.id, studentId } },
      update: { status: status as AttendanceStatus, note, recordedAt: new Date() },
      create: { sessionId: attendanceSession.id, studentId, status: status as AttendanceStatus, note },
      include: { student: { select: { name: true, rollNumber: true } }, session: true },
    });
    const risk = await refreshOneStudentRisk(tx, studentId);
    return { record, riskSnapshot: risk?.snapshot ?? null };
  });
  return Response.json({ ...result }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

async function createGrade(session: DemoSession, body: Record<string, unknown>) {
  if (session.role !== "FACULTY" && session.role !== "ADMIN") {
    return jsonError("Only Faculty or Admin can record marks.", 403);
  }
  const studentId = validString(body, "studentId");
  const courseId = validString(body, "courseId");
  const term = validString(body, "term");
  const fields = ["cia", "midterm", "lab", "assignment"] as const;
  const scores = Object.fromEntries(fields.map((field) => [field, body[field]])) as Record<(typeof fields)[number], unknown>;
  if (!studentId || !courseId || !term || fields.some((field) => (
    typeof scores[field] !== "number" || !Number.isFinite(scores[field]) || scores[field] < 0 || scores[field] > 100
  ))) {
    return jsonError("Student, course, term, and scores from 0 to 100 are required.", 400);
  }
  const [authorizedStudent, courseAllowed] = await Promise.all([
    canManageStudent(session, studentId),
    canAccessCourse(session, courseId),
  ]);
  const enrollment = await prisma.enrollment.findFirst({
    where: { studentId, courseId, isActive: true },
    select: { id: true },
  });
  if (!authorizedStudent || !courseAllowed || !enrollment) {
    return jsonError("Student or course is outside your authorized academic scope.", 403);
  }
  const result = await prisma.$transaction(async (tx) => {
    const grade = await tx.grade.upsert({
      where: { studentId_courseId_term: { studentId, courseId, term } },
      update: {
        cia: scores.cia as number,
        midterm: scores.midterm as number,
        lab: scores.lab as number,
        assignment: scores.assignment as number,
        recordedAt: new Date(),
      },
      create: {
        studentId,
        courseId,
        term,
        cia: scores.cia as number,
        midterm: scores.midterm as number,
        lab: scores.lab as number,
        assignment: scores.assignment as number,
      },
    });
    const risk = await refreshOneStudentRisk(tx, studentId);
    return { grade, riskSnapshot: risk?.snapshot ?? null };
  });
  return Response.json({ ...result }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

async function createExam(session: DemoSession, body: Record<string, unknown>) {
  if (!["FACULTY", "HOD", "ADMIN"].includes(session.role)) {
    return jsonError("This role cannot create exams.", 403);
  }
  const code = validString(body, "code");
  const name = validString(body, "name");
  const departmentId = validString(body, "departmentId");
  const courseId = typeof body.courseId === "string" && body.courseId.trim() ? body.courseId.trim() : null;
  const scheduledAt = parseDate(body.scheduledAt);
  if (!code || !name || !departmentId || !scheduledAt) {
    return jsonError("Exam code, name, departmentId, and scheduledAt are required.", 400);
  }
  if (!await canAccessDepartment(session, departmentId)) {
    return jsonError("Department is outside your authorized academic scope.", 403);
  }
  if (session.role === "FACULTY" && (!courseId || !await canAccessCourse(session, courseId))) {
    return jsonError("Faculty may create an exam only for an assigned course.", 403);
  }
  const participationInput = Array.isArray(body.participations) ? body.participations : [];
  const participants: Array<{ studentId: string; status: ExamStatus }> = [];
  for (const item of participationInput) {
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      return jsonError("Exam participation records must be objects.", 400);
    }
    const record = item as Record<string, unknown>;
    const studentId = validString(record, "studentId");
    const status = typeof record.status === "string" ? record.status : "";
    const student = studentId ? await prisma.student.findFirst({
      where: {
        id: studentId,
        departmentId,
        ...(courseId ? { enrollments: { some: { courseId, isActive: true } } } : {}),
        ...studentScopeWhere(session),
      },
      select: { id: true },
    }) : null;
    if (!studentId || !examStatuses.has(status) || !student) {
      return jsonError("Exam participants must be valid students within your authorized scope.", 403);
    }
    participants.push({ studentId, status: status as ExamStatus });
  }
  if (new Set(participants.map(({ studentId }) => studentId)).size !== participants.length) {
    return jsonError("Each student may appear only once in an exam request.", 400);
  }

  try {
    const exam = await prisma.$transaction(async (tx) => {
      const created = await tx.exam.create({
        data: {
          code,
          name,
          departmentId,
          courseId,
          scheduledAt,
          createdById: session.user.id,
          participations: {
            create: participants.map(({ studentId, status }) => ({ studentId, status })),
          },
        },
        include: { participations: true },
      });
      const absent = participants.filter((participant) => participant.status === ExamStatus.ABSENT);
      for (const participant of absent) {
        const dedupeKey = `EXAM_ABSENCE:${created.id}:${participant.studentId}`;
        await tx.notificationEvent.upsert({
          where: { dedupeKey },
          update: {},
          create: {
            type: NotificationEventType.EXAM_ABSENCE,
            title: "Exam absence recorded",
            description: "An exam absence status was recorded and requires review.",
            payload: { examId: created.id },
            studentId: participant.studentId,
            departmentId,
            targetRole: "MENTOR",
            dedupeKey,
          },
        });
      }
      return created;
    });
    return Response.json({ exam }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return jsonError("An exam with this code already exists.", 409);
    }
    throw error;
  }
}

async function createIntervention(session: DemoSession, body: Record<string, unknown>) {
  if (!["FACULTY", "MENTOR", "HOD", "ADMIN"].includes(session.role)) {
    return jsonError("This role cannot create interventions.", 403);
  }
  const studentId = validString(body, "studentId");
  const title = validString(body, "title");
  const dueAt = body.dueAt === undefined ? null : parseDate(body.dueAt);
  if (!studentId || !title || (body.dueAt !== undefined && !dueAt)) {
    return jsonError("Student and intervention title are required; dueAt must be a valid timestamp.", 400);
  }
  const allowed = session.role === "MENTOR"
    ? Boolean(await prisma.mentorAssignment.findFirst({
      where: { studentId, mentor: { userId: session.user.id }, isActive: true },
      select: { id: true },
    }))
    : await canManageStudent(session, studentId);
  if (!allowed) return jsonError("Student is outside your authorized academic scope.", 403);

  const intervention = await prisma.$transaction(async (tx) => {
    const created = await tx.intervention.create({
      data: {
        studentId,
        title,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "",
        dueAt,
        createdById: session.user.id,
      },
    });
    await tx.notificationEvent.create({
      data: {
        type: NotificationEventType.OTHER,
        title: "Academic intervention created",
        description: "A new academic intervention was created.",
        payload: { interventionId: created.id },
        studentId,
        targetRole: "MENTOR",
        dedupeKey: `INTERVENTION_CREATED:${created.id}`,
      },
    });
    return created;
  });
  return Response.json({ intervention }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

async function createParentFollowUp(session: DemoSession, body: Record<string, unknown>) {
  if (!["FACULTY", "HOD", "ADMIN"].includes(session.role)) {
    return jsonError("This role cannot create parent follow-ups.", 403);
  }
  const studentId = validString(body, "studentId");
  const reason = validString(body, "reason");
  const dueAt = body.dueAt === undefined ? null : parseDate(body.dueAt);
  if (!studentId || !reason || (body.dueAt !== undefined && !dueAt)) {
    return jsonError("Student and reason are required; dueAt must be a valid timestamp.", 400);
  }
  if (!await canManageStudent(session, studentId)) return jsonError("Student is outside your authorized academic scope.", 403);

  const followUp = await prisma.$transaction(async (tx) => {
    const created = await tx.parentFollowUp.create({
      data: {
        studentId,
        reason,
        dueAt,
        urgent: body.urgent === true,
        notes: typeof body.notes === "string" ? body.notes.trim().slice(0, 2000) : "",
      },
    });
    await tx.notificationEvent.create({
      data: {
        type: NotificationEventType.PARENT_FOLLOWUP_REQUIRED,
        title: "Parent follow-up required",
        description: "A parent follow-up was created and requires action.",
        payload: { followUpId: created.id, urgent: created.urgent },
        studentId,
        targetRole: "MENTOR",
        dedupeKey: `PARENT_FOLLOWUP:${created.id}`,
      },
    });
    return created;
  });
  return Response.json({ followUp }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
}

const readHandlers: Record<AcademicResource, (session: DemoSession) => Promise<unknown>> = {
  students: listStudents,
  attendance: listAttendance,
  marks: listMarks,
  exams: listExams,
  risk: listRiskSnapshots,
  interventions: listInterventions,
  "parent-followups": listParentFollowUps,
  departments: listDepartments,
  "notification-events": listNotificationEvents,
  "email-history": listEmailHistory,
};

export async function handleAcademicGet(
  request: Request,
  session: DemoSession | null,
  resource: AcademicResource,
): Promise<Response> {
  if (!session) return jsonError("Please sign in again.", 401);
  if (!process.env.DATABASE_URL?.trim()) {
    return jsonError("Academic PostgreSQL storage is not configured. Set DATABASE_URL before using this API.", 503);
  }
  if (resource === "email-history" && session.role !== "ADMIN") {
    return jsonError("Only Admin can view email history.", 403);
  }

  try {
    if (!await hasDatabaseRole(session)) return jsonError("Your signed-in account is not provisioned for academic data access.", 403);
    const result = await readHandlers[resource](session);
    if (isResponse(result)) return result;
    return Response.json({ [resource === "email-history" ? "entries" : resource]: result }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error(`Academic ${resource} read failed.`, error);
    return jsonError("Academic data is temporarily unavailable.", 500);
  }
}

export async function handleAcademicPost(
  request: Request,
  session: DemoSession | null,
  resource: AcademicResource,
): Promise<Response> {
  if (!session) return jsonError("Please sign in again.", 401);
  if (!process.env.DATABASE_URL?.trim()) {
    return jsonError("Academic PostgreSQL storage is not configured. Set DATABASE_URL before using this API.", 503);
  }
  const body = await readBody(request);
  if (isResponse(body)) return body;
  try {
    if (!await hasDatabaseRole(session)) return jsonError("Your signed-in account is not provisioned for academic data access.", 403);
    switch (resource) {
      case "attendance":
        return await createAttendance(session, body);
      case "marks":
        return await createGrade(session, body);
      case "exams":
        return await createExam(session, body);
      case "interventions":
        return await createIntervention(session, body);
      case "parent-followups":
        return await createParentFollowUp(session, body);
      default:
        return jsonError("This academic resource does not accept writes.", 405);
    }
  } catch (error) {
    console.error(`Academic ${resource} write failed.`, error);
    return jsonError("Academic update failed. No success was recorded.", 500);
  }
}
