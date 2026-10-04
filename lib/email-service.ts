import "server-only";

import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import nodemailer, { type Transporter } from "nodemailer";
import { EmailKind as PrismaEmailKind, EmailStatus as PrismaEmailStatus } from "@prisma/client";
import type { AuthRole } from "@/lib/auth-types";
import {
  buildAdminInstitutionEmail,
  buildHODDepartmentEmail,
  buildMentorAttendanceEmail,
  type LeadershipAttendanceData,
  type MentorAttendanceData,
} from "@/lib/demo-attendance-notifications";
import { isDatabaseConfigured, prisma } from "@/lib/prisma";
import {
  buildImmediateAlertEmail,
  buildRoleDigestEmail,
  shouldSendHourlyDigest,
  summarizeAcademicDigestDelta,
  type AcademicEmailSettings,
  type AcademicDigestSnapshot,
} from "@/lib/academic-email-engine";

export type EmailHistoryStatus = "SENT" | "FAILED" | "PENDING" | "SKIPPED";
export type EmailKind = "TEST" | "DIGEST" | "ALERT";

export interface EmailSendResult {
  success: boolean;
  recipient: string;
  timestamp: string;
  errorMessage?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  role?: AuthRole;
  kind?: EmailKind;
}

export interface EmailHistoryEntry {
  status: EmailHistoryStatus;
  kind: EmailKind;
  role?: AuthRole;
  recipient: string;
  subject: string;
  timestamp: string;
  attempt?: number;
  errorMessage?: string;
}

export interface DemoAttendanceNotification {
  course: string;
  className: string;
  updatedBy: string;
  timestamp: string;
  mentor: MentorAttendanceData;
  hod: LeadershipAttendanceData;
  admin: LeadershipAttendanceData;
}

export interface DemoAttendanceDelivery {
  role: Extract<AuthRole, "HOD" | "MENTOR" | "ADMIN">;
  recipient: string;
  status: EmailHistoryStatus;
  timestamp: string;
  errorMessage?: string;
}

interface SmtpConfiguration {
  from: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

const historyFile = resolve(
  /*turbopackIgnore: true*/ process.env.EMAIL_HISTORY_PATH
    ?? resolve(process.cwd(), ".data", "academic-email-history.jsonl"),
);
const demoAttendanceEventsFile = resolve(process.cwd(), ".data", "demo-academic-notification-events.jsonl");
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];
const transportCache = globalThis as typeof globalThis & { __luminaEmailTransport?: Transporter };

function readSmtpConfiguration(): SmtpConfiguration {
  const { EMAIL_FROM, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, EMAIL_SMTP_PASSWORD } = process.env;
  if (!EMAIL_FROM || !EMAIL_SMTP_HOST || !EMAIL_SMTP_PORT || !EMAIL_SMTP_USER || !EMAIL_SMTP_PASSWORD) {
    throw new Error("Email SMTP is not configured. Set EMAIL_FROM, EMAIL_SMTP_HOST, EMAIL_SMTP_PORT, EMAIL_SMTP_USER, and EMAIL_SMTP_PASSWORD.");
  }

  const port = Number(EMAIL_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("EMAIL_SMTP_PORT must be a valid TCP port.");
  }

  return {
    from: EMAIL_FROM,
    host: EMAIL_SMTP_HOST,
    port,
    user: EMAIL_SMTP_USER,
    password: EMAIL_SMTP_PASSWORD,
  };
}

function getTransport(configuration: SmtpConfiguration): Transporter {
  if (!transportCache.__luminaEmailTransport) {
    transportCache.__luminaEmailTransport = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.port === 465,
      auth: {
        user: configuration.user,
        pass: configuration.password,
      },
    });
  }
  return transportCache.__luminaEmailTransport;
}

function isRetryable(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ("responseCode" in error && typeof error.responseCode === "number") {
    return error.responseCode >= 400 && error.responseCode < 500;
  }
  return false;
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "Email delivery failed for an unknown reason.";
  const password = process.env.EMAIL_SMTP_PASSWORD;
  return password ? message.split(password).join("[REDACTED]") : message;
}

async function recordHistory(entry: EmailHistoryEntry): Promise<void> {
  if (isDatabaseConfigured()) {
    await prisma.emailHistory.create({
      data: {
        status: entry.status as PrismaEmailStatus,
        kind: entry.kind as PrismaEmailKind,
        recipient: entry.recipient,
        recipientRole: entry.role,
        subject: entry.subject,
        attempt: entry.attempt ?? 0,
        errorMessage: entry.errorMessage,
        createdAt: new Date(entry.timestamp),
        ...(entry.status === "SENT" ? { sentAt: new Date(entry.timestamp) } : {}),
      },
    });
    return;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production email history requires DATABASE_URL.");
  }
  await mkdir(dirname(historyFile), { recursive: true, mode: 0o700 });
  await appendFile(historyFile, `${JSON.stringify(entry)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function getRecipientForRole(role: AuthRole | string): string | null {
  switch (role.trim().toUpperCase()) {
    case "HOD":
      return process.env.HOD_EMAIL?.trim() || null;
    case "MENTOR":
      return process.env.MENTOR_EMAIL?.trim() || null;
    case "ADMIN":
      return process.env.ADMIN_EMAIL?.trim() || null;
    default:
      return null;
  }
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  const timestamp = new Date().toISOString();
  const kind = message.kind ?? "DIGEST";
  const historyBase = {
    kind,
    ...(message.role ? { role: message.role } : {}),
    recipient: message.to,
    subject: message.subject,
  };

  let configuration: SmtpConfiguration;
  try {
    configuration = readSmtpConfiguration();
  } catch (error) {
    const reason = errorMessage(error);
    await recordHistory({
      ...historyBase,
      status: "FAILED",
      timestamp,
      attempt: 0,
      errorMessage: reason,
    });
    return { success: false, recipient: message.to, timestamp, errorMessage: reason };
  }

  await recordHistory({ ...historyBase, status: "PENDING", timestamp });

  const transport = getTransport(configuration);
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await transport.sendMail({
        from: configuration.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
      });
      const sentAt = new Date().toISOString();
      await recordHistory({ ...historyBase, status: "SENT", timestamp: sentAt, attempt });
      return { success: true, recipient: message.to, timestamp: sentAt };
    } catch (error) {
      const reason = errorMessage(error);
      const failedAt = new Date().toISOString();
      const retry = attempt < MAX_RETRY_ATTEMPTS && isRetryable(error);
      await recordHistory({
        ...historyBase,
        status: retry ? "PENDING" : "FAILED",
        timestamp: failedAt,
        attempt,
        errorMessage: reason,
      });
      if (!retry) return { success: false, recipient: message.to, timestamp: failedAt, errorMessage: reason };
      await new Promise((resolveDelay) => setTimeout(resolveDelay, RETRY_DELAYS_MS[attempt - 1]));
    }
  }

  return {
    success: false,
    recipient: message.to,
    timestamp: new Date().toISOString(),
    errorMessage: "Email delivery exhausted its retry attempts.",
  };
}

export async function sendHourlyDigest(
  role: AuthRole,
  snapshot: AcademicDigestSnapshot,
  options: {
    previousSnapshot?: Partial<AcademicDigestSnapshot> | null;
    settings?: Partial<AcademicEmailSettings>;
  } = {},
): Promise<EmailSendResult> {
  const recipient = getRecipientForRole(role);
  if (!recipient) {
    const skippedAt = new Date().toISOString();
    await recordHistory({
      status: "SKIPPED",
      kind: "DIGEST",
      role,
      recipient: "",
      subject: `[Lumina AI] ${role} Academic Update`,
      timestamp: skippedAt,
      errorMessage: "No recipient is configured for this role.",
    });
    return { success: false, recipient: "", timestamp: skippedAt, errorMessage: "No recipient is configured for this role." };
  }

  if (!shouldSendHourlyDigest(options.previousSnapshot, snapshot, options.settings)) {
    const skippedAt = new Date().toISOString();
    const summary = summarizeAcademicDigestDelta(options.previousSnapshot, snapshot).compactSummary;
    await recordHistory({
      status: "SKIPPED",
      kind: "DIGEST",
      role,
      recipient,
      subject: `[Lumina AI] ${role} Academic Update — ${snapshot.scopeName ?? "Academic Workspace"}`,
      timestamp: skippedAt,
      errorMessage: summary,
    });
    return { success: false, recipient, timestamp: skippedAt, errorMessage: summary };
  }

  const digest = buildRoleDigestEmail(role, snapshot, {
    scopeLabel: snapshot.scopeName ?? "Academic Workspace",
    generatedAt: new Date(),
  });
  const digestSettings = { compactSummaryWhenIdle: true, ...options.settings };
  const unchanged = options.previousSnapshot !== undefined
    && !summarizeAcademicDigestDelta(options.previousSnapshot, snapshot).changed;
  return sendEmail({
    to: recipient,
    subject: digest.subject,
    text: unchanged && digestSettings.compactSummaryWhenIdle
      ? `Hourly academic summary for ${snapshot.scopeName ?? "Academic Workspace"}.\n\n${summarizeAcademicDigestDelta(options.previousSnapshot, snapshot).summary.join("\n")}`
      : digest.body,
    role,
    kind: "DIGEST",
  });
}

export async function sendCriticalAlert(
  role: Extract<AuthRole, "HOD" | "MENTOR" | "ADMIN">,
  event: Parameters<typeof buildImmediateAlertEmail>[0],
): Promise<EmailSendResult> {
  const recipient = getRecipientForRole(role);
  if (!recipient) {
    const skippedAt = new Date().toISOString();
    await recordHistory({
      status: "SKIPPED",
      kind: "ALERT",
      role,
      recipient: "",
      subject: "[Lumina AI] Critical Academic Alert — Action Required",
      timestamp: skippedAt,
      errorMessage: "No recipient is configured for this role.",
    });
    return { success: false, recipient: "", timestamp: skippedAt, errorMessage: "No recipient is configured for this role." };
  }

  const alert = buildImmediateAlertEmail(event);
  return sendEmail({
    to: recipient,
    subject: alert.subject,
    text: alert.body,
    role,
    kind: "ALERT",
  });
}

export async function sendDevelopmentTestEmail(): Promise<EmailSendResult> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Test email is available only in development.");
  }

  const recipient = getRecipientForRole("ADMIN");
  if (!recipient) {
    const timestamp = new Date().toISOString();
    const error = "ADMIN_EMAIL must be configured before sending the test email.";
    await recordHistory({
      status: "FAILED",
      kind: "TEST",
      role: "ADMIN",
      recipient: "",
      subject: "[Lumina AI] Test Email",
      timestamp,
      attempt: 0,
      errorMessage: error,
    });
    return { success: false, recipient: "", timestamp, errorMessage: error };
  }

  return sendEmail({
    to: recipient,
    subject: "[Lumina AI] Test Email",
    text: "Lumina AI email notification system is working successfully.",
    role: "ADMIN",
    kind: "TEST",
  });
}

export async function sendDemoAttendanceNotification(
  summary: DemoAttendanceNotification,
): Promise<{ eventId: string; deliveries: DemoAttendanceDelivery[] }> {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo attendance notifications are available only in development.");
  }

  const eventId = randomUUID();
  await mkdir(dirname(demoAttendanceEventsFile), { recursive: true, mode: 0o700 });
  await appendFile(demoAttendanceEventsFile, `${JSON.stringify({
    id: eventId,
    type: "DEMO_ATTENDANCE_UPDATE",
    course: summary.course,
    className: summary.className,
    updatedBy: summary.updatedBy,
    timestamp: summary.timestamp,
  })}\n`, { encoding: "utf8", mode: 0o600 });

  const mentorEmail = buildMentorAttendanceEmail(summary.mentor);
  const hodEmail = buildHODDepartmentEmail(summary.hod);
  const adminEmail = buildAdminInstitutionEmail(summary.admin);
  const recipients = [
    { role: "MENTOR", email: mentorEmail },
    { role: "HOD", email: hodEmail },
    { role: "ADMIN", email: adminEmail },
  ] as const;
  const deliveries: DemoAttendanceDelivery[] = [];

  for (const { role, email } of recipients) {
    const roleName = role;
    const recipient = getRecipientForRole(role);
    if (!recipient) {
      const timestamp = new Date().toISOString();
      const reason = `${roleName}_EMAIL is not configured.`;
      await recordHistory({
        status: "SKIPPED",
        kind: "ALERT",
        role,
        recipient: "",
        subject: email.subject,
        timestamp,
        errorMessage: reason,
      });
      deliveries.push({ role, recipient: "", status: "SKIPPED", timestamp, errorMessage: reason });
      console.info("Email notification triggered", { recipient: "", status: "SKIPPED", timestamp });
      continue;
    }

    try {
      const result = await sendEmail({
        to: recipient,
        subject: email.subject,
        text: email.body,
        role,
        kind: "ALERT",
      });
      const delivery: DemoAttendanceDelivery = {
        role,
        recipient,
        status: result.success ? "SENT" : "FAILED",
        timestamp: result.timestamp,
        ...(result.errorMessage ? { errorMessage: result.errorMessage } : {}),
      };
      deliveries.push(delivery);
      console.info("Email notification triggered", {
        recipient: delivery.recipient,
        status: delivery.status,
        timestamp: delivery.timestamp,
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      const reason = errorMessage(error);
      try {
        await recordHistory({
          status: "FAILED",
          kind: "ALERT",
          role,
          recipient,
          subject: email.subject,
          timestamp,
          attempt: 0,
          errorMessage: reason,
        });
      } catch (historyError) {
        console.error("Demo email failure could not be written to email history.", {
          recipient,
          error: errorMessage(historyError),
        });
      }
      deliveries.push({ role, recipient, status: "FAILED", timestamp, errorMessage: reason });
      console.error("Email notification triggered", {
        recipient,
        status: "FAILED",
        timestamp,
        errorMessage: reason,
      });
    }
  }

  return { eventId, deliveries };
}

export async function getEmailHistory(limit = 100): Promise<EmailHistoryEntry[]> {
  if (isDatabaseConfigured()) {
    const rows = await prisma.emailHistory.findMany({
      take: Math.max(1, Math.floor(limit)),
      orderBy: { createdAt: "desc" },
      select: {
        status: true,
        kind: true,
        recipient: true,
        recipientRole: true,
        subject: true,
        attempt: true,
        errorMessage: true,
        createdAt: true,
        sentAt: true,
      },
    });
    return rows.map((entry) => ({
      status: entry.status,
      kind: entry.kind,
      role: entry.recipientRole ?? undefined,
      recipient: entry.recipient,
      subject: entry.subject,
      attempt: entry.attempt,
      errorMessage: entry.errorMessage ?? undefined,
      timestamp: (entry.sentAt ?? entry.createdAt).toISOString(),
    }));
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Production email history requires DATABASE_URL.");
  }

  let content: string;
  try {
    content = await readFile(/*turbopackIgnore: true*/ historyFile, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const lines = content.split("\n").filter(Boolean);
  const history = lines.map((line) => JSON.parse(line) as EmailHistoryEntry);
  return history.slice(-Math.max(1, Math.floor(limit))).reverse();
}
