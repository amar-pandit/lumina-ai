import "server-only";

import type { DemoSession } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { studentScopeWhere } from "@/lib/academic-scope";

export { studentScopeWhere } from "@/lib/academic-scope";

export async function canAccessStudent(session: DemoSession, studentId: string): Promise<boolean> {
  return Boolean(await prisma.student.findFirst({
    where: { id: studentId, ...studentScopeWhere(session) },
    select: { id: true },
  }));
}

export async function canManageStudent(session: DemoSession, studentId: string): Promise<boolean> {
  if (session.role === "STUDENT" || session.role === "MENTOR") return false;
  return canAccessStudent(session, studentId);
}

export async function canAccessCourse(session: DemoSession, courseId: string): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (session.role === "STUDENT" || session.role === "MENTOR") return false;

  if (session.role === "FACULTY") {
    return Boolean(await prisma.facultyCourse.findFirst({
      where: { courseId, faculty: { userId: session.user.id } },
      select: { courseId: true },
    }));
  }

  return Boolean(await prisma.course.findFirst({
    where: {
      id: courseId,
      OR: [
        { department: { headUserId: session.user.id } },
        { enrollments: { some: { student: { department: { headUserId: session.user.id } } } } },
      ],
    },
    select: { id: true },
  }));
}

export async function canAccessDepartment(session: DemoSession, departmentId: string): Promise<boolean> {
  if (session.role === "ADMIN") return true;
  if (session.role === "HOD") {
    return Boolean(await prisma.department.findFirst({
      where: { id: departmentId, headUserId: session.user.id },
      select: { id: true },
    }));
  }
  if (session.role === "FACULTY") {
    return Boolean(await prisma.faculty.findFirst({
      where: { userId: session.user.id, departmentId },
      select: { id: true },
    }));
  }
  if (session.role === "MENTOR") {
    return Boolean(await prisma.mentorAssignment.findFirst({
      where: {
        mentor: { userId: session.user.id },
        isActive: true,
        student: { departmentId },
      },
      select: { id: true },
    }));
  }
  return Boolean(await prisma.student.findFirst({
    where: { authUserId: session.user.id, departmentId },
    select: { id: true },
  }));
}
