import type { AuthRole, DemoUserId } from "@/lib/auth-types";

export interface DemoAccountCredential {
  id: DemoUserId;
  email: string;
  password: string;
  role: AuthRole;
  name: string;
}

export const DEMO_ACCOUNT_CREDENTIALS: readonly DemoAccountCredential[] = [
  { id: "student-demo-001", email: "student@lumina.demo", password: "student123", role: "STUDENT", name: "Amar Kumar" },
  { id: "faculty-demo-001", email: "faculty@lumina.demo", password: "faculty123", role: "FACULTY", name: "Dr. Meera Shah" },
  { id: "mentor-demo-001", email: "mentor@lumina.demo", password: "mentor123", role: "MENTOR", name: "Rohan Mehta" },
  { id: "hod-demo-001", email: "hod@lumina.demo", password: "hod123", role: "HOD", name: "Dr. Priya Nair" },
  { id: "admin-demo-001", email: "admin@lumina.demo", password: "admin123", role: "ADMIN", name: "Lumina Administrator" },
];
