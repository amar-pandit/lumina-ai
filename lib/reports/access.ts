import type { AuthRole } from "@/lib/auth-types";

export function canGenerateReport(role: AuthRole, reportType: string): boolean {
  if (role === "ADMIN") return reportType.startsWith("admin-");
  if (role === "HOD") return reportType.startsWith("hod-") ||
    reportType === "faculty-attendance" || reportType === "faculty-gradebook";
  if (role === "MENTOR") return reportType.startsWith("mentor-");
  if (role === "FACULTY") return reportType.startsWith("faculty-");
  return false;
}
