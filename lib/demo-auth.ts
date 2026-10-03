import { DEMO_STUDENT } from "@/lib/student-demo-data";
import type { DemoUser } from "@/lib/auth-types";
import { DEMO_ACCOUNT_CREDENTIALS } from "@/lib/auth/demo-account-credentials";

export type { AuthRole, DemoUser } from "@/lib/auth-types";

export interface DemoAccount extends DemoUser {
  password: string;
}

export const DEMO_ACCOUNTS: readonly DemoAccount[] = DEMO_ACCOUNT_CREDENTIALS.map((account) => ({
  ...account,
  name: account.role === "STUDENT" ? DEMO_STUDENT.name : account.name,
  ...(account.role === "STUDENT" ? { studentId: DEMO_STUDENT.id } : {}),
}));

export const REMEMBERED_EMAIL_KEY = "lumina_remembered_email";

export function notifyDemoAuthChange(): void {
  window.dispatchEvent(new Event("lumina-auth-change"));
}

export function clearLegacyDemoAuth(): void {
  window.localStorage.removeItem("lumina_user");
  window.localStorage.removeItem("lumina_role");
}
