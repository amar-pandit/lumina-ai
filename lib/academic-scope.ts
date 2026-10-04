import type { Prisma } from "@prisma/client";
import type { DemoSession } from "@/lib/auth-types";

export function studentScopeWhere(session: DemoSession): Prisma.StudentWhereInput {
  switch (session.role) {
    case "STUDENT":
      return { authUserId: session.user.id };
    case "MENTOR":
      return {
        mentorAssignments: {
          some: {
            mentor: { userId: session.user.id },
            isActive: true,
            OR: [{ endsAt: null }, { endsAt: { gt: new Date() } }],
          },
        },
      };
    case "HOD":
      return { department: { headUserId: session.user.id } };
    case "FACULTY":
      return {
        enrollments: {
          some: {
            isActive: true,
            course: {
              faculty: {
                some: { faculty: { userId: session.user.id } },
              },
            },
          },
        },
      };
    case "ADMIN":
      return {};
  }
}
