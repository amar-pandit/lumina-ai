import type { AuthRole } from "@/lib/auth-types";

const REPORT_PREFIXES_BY_ROLE: Record<AuthRole, readonly string[]> = {
  STUDENT: ["student-"],
  FACULTY: ["faculty-"],
  MENTOR: ["mentor-"],
  HOD: ["hod-", "faculty-attendance", "faculty-gradebook"],
  ADMIN: ["admin-", "hod-", "faculty-", "mentor-"],
};

function isReportRole(role: string): role is AuthRole {
  return Object.hasOwn(REPORT_PREFIXES_BY_ROLE, role);
}

export function canGenerateReport(role: AuthRole | string | null, reportType: string): boolean {
  if (typeof role !== "string" || typeof reportType !== "string") return false;

  const normalizedRole = role.trim().toUpperCase();
  const normalizedReportType = reportType.trim().toLowerCase();
  if (!isReportRole(normalizedRole) || !normalizedReportType) return false;

  return REPORT_PREFIXES_BY_ROLE[normalizedRole].some((prefix) => (
    prefix.endsWith("-")
      ? normalizedReportType.startsWith(prefix)
      : normalizedReportType === prefix
  ));
}
