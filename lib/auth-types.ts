export const AUTH_ROLES = ["STUDENT", "FACULTY", "MENTOR", "HOD", "ADMIN"] as const;

export type AuthRole = (typeof AUTH_ROLES)[number];

export const DEMO_USER_IDS = {
  STUDENT: "student-demo-001",
  FACULTY: "faculty-demo-001",
  MENTOR: "mentor-demo-001",
  HOD: "hod-demo-001",
  ADMIN: "admin-demo-001",
} as const satisfies Record<AuthRole, string>;

export type DemoUserId = (typeof DEMO_USER_IDS)[keyof typeof DEMO_USER_IDS];

export interface DemoUser {
  id: DemoUserId;
  name: string;
  email: string;
  role: AuthRole;
  studentId?: string;
}

export interface DemoSession {
  user: DemoUser;
  role: AuthRole;
  authenticated: true;
}

export function isAuthRole(value: unknown): value is AuthRole {
  return AUTH_ROLES.some((role) => role === value);
}

export function isDemoSession(value: unknown): value is DemoSession {
  if (
    typeof value !== "object" ||
    value === null ||
    !("user" in value) ||
    !("role" in value) ||
    !("authenticated" in value)
  ) {
    return false;
  }

  const user = value.user;
  return (
    value.authenticated === true &&
    isAuthRole(value.role) &&
    typeof user === "object" &&
    user !== null &&
    "id" in user &&
    user.id === DEMO_USER_IDS[value.role] &&
    "name" in user &&
    typeof user.name === "string" &&
    "email" in user &&
    typeof user.email === "string" &&
    "role" in user &&
    user.role === value.role &&
    (!("studentId" in user) || typeof user.studentId === "string")
  );
}

export function dashboardForRole(role: AuthRole): string {
  if (role === "STUDENT") return "/student/dashboard";
  if (role === "FACULTY") return "/faculty/dashboard";
  if (role === "MENTOR") return "/mentor/dashboard";
  if (role === "HOD") return "/hod/dashboard";
  return "/admin/dashboard";
}

export function hasRole(role: AuthRole | null, allowedRoles: readonly AuthRole[]): role is AuthRole {
  return role !== null && allowedRoles.includes(role);
}

export function canAccessRoute(role: AuthRole, pathname: string): boolean {
  const isWithin = (routeRoot: string) => pathname === routeRoot || pathname.startsWith(`${routeRoot}/`);
  if (role === "STUDENT") return isWithin("/student");
  if (role === "FACULTY") return isWithin("/faculty");
  if (role === "MENTOR") return isWithin("/mentor") || isWithin("/faculty");
  if (role === "HOD") {
    return isWithin("/hod") ||
      pathname === "/faculty/courses/demo/attendance-grid" ||
      pathname === "/faculty/courses/demo/gradebook" ||
      pathname === "/mentor/dashboard";
  }
  return isWithin("/admin");
}

export function getAllowedRoles(role: AuthRole): readonly AuthRole[] {
  return [role];
}
