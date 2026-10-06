import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { cookies } from "next/headers";
import { dirname, resolve } from "node:path";
import { DEMO_ACCOUNTS, type DemoAccount } from "@/lib/demo-auth";
import { matchPasswordCredential } from "@/lib/auth/credential-match";
import {
  hasRole,
  type AuthRole,
  type DemoSession,
  type DemoUserId,
  type DemoUser,
} from "@/lib/auth-types";

export { canAccessRoute, dashboardForRole, getAllowedRoles, hasRole } from "@/lib/auth-types";
export type { AuthRole, DemoSession, DemoUser } from "@/lib/auth-types";

const SESSION_COOKIE = "lumina_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;
const developmentSecretPath = resolve(process.cwd(), ".data", "auth-session.key");

interface SessionClaims {
  userId?: string;
  email?: string;
  expiresAt: number;
}

function getSessionSecret(): Buffer {
  const configuredSecret = process.env.LUMINA_AUTH_SECRET;
  if (configuredSecret) {
    const secret = Buffer.from(configuredSecret, "utf8");
    if (secret.byteLength < 32) {
      throw new Error("LUMINA_AUTH_SECRET must be at least 32 bytes.");
    }
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("LUMINA_AUTH_SECRET must be configured in production.");
  }

  mkdirSync(dirname(developmentSecretPath), { recursive: true, mode: 0o700 });
  try {
    const descriptor = openSync(developmentSecretPath, "wx", 0o600);
    try {
      writeFileSync(descriptor, randomBytes(32));
    } finally {
      closeSync(descriptor);
    }
  } catch (cause) {
    if (!(cause instanceof Error) || !("code" in cause) || cause.code !== "EEXIST") throw cause;
  }

  const secret = readFileSync(developmentSecretPath);
  if (secret.byteLength !== 32) {
    throw new Error("The development auth-session key is invalid.");
  }
  return secret;
}

function sign(value: string): Buffer {
  return createHmac("sha256", getSessionSecret()).update(value).digest();
}

function createSessionToken(userId: string): string {
  const claims: SessionClaims = {
    userId,
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${sign(payload).toString("base64url")}`;
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge,
  };
}

function findAccountById(userId: string): DemoAccount | undefined {
  return DEMO_ACCOUNTS.find((account) => account.id === userId);
}

function toSession(account: DemoAccount): DemoSession {
  const user: DemoUser = {
    id: account.id,
    name: account.name,
    email: account.email,
    role: account.role,
    ...(account?.studentId ? { studentId: account.studentId } : {}),
  };
  return { user, role: account.role, authenticated: true };
}

function verifySessionToken(token: string): DemoSession | null {
  const [payload, providedSignature, extra] = token.split(".");
  if (!payload || !providedSignature || extra !== undefined) return null;

  const expectedSignature = sign(payload);
  const actualSignature = Buffer.from(providedSignature, "base64url");
  if (
    actualSignature.byteLength !== expectedSignature.byteLength ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  let claims: unknown;
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }

  if (
    typeof claims !== "object" ||
    claims === null ||
    !("expiresAt" in claims) ||
    typeof claims.expiresAt !== "number" ||
    claims.expiresAt <= Date.now()
  ) {
    return null;
  }

  const userId = "userId" in claims && typeof claims.userId === "string" ? claims.userId : null;
  const legacyEmail = "email" in claims && typeof claims.email === "string"
    ? claims.email.toLowerCase()
    : null;
  const user = userId
    ? findAccountById(userId)
    : legacyEmail
      ? DEMO_ACCOUNTS.find((account) => account.email.toLowerCase() === legacyEmail) ?? null
      : null;
  return user ? toSession(user) : null;
}

async function setAuthenticatedSession(user: DemoAccount): Promise<DemoSession> {
  const cookieStore = await cookies();
  cookieStore.set(
    SESSION_COOKIE,
    createSessionToken(user.id),
    sessionCookieOptions(SESSION_MAX_AGE_SECONDS),
  );
  return toSession(user);
}

export async function login(identifier: string, password: string): Promise<DemoSession | null> {
  const account = matchPasswordCredential(DEMO_ACCOUNTS, identifier, password);
  const cookieStore = await cookies();
  if (!account) {
    cookieStore.set(SESSION_COOKIE, "", sessionCookieOptions(0));
    return null;
  }

  return setAuthenticatedSession(account);
}

export async function loginWithFaceIdentity(userId: DemoUserId): Promise<DemoSession> {
  const account = findAccountById(userId);
  if (!account) throw new Error("Verified face identity does not map to an available Lumina account.");
  return setAuthenticatedSession(account);
}

export async function logout(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", sessionCookieOptions(0));
}

export async function getCurrentUser(): Promise<DemoSession | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}

export async function getCurrentRole(): Promise<AuthRole | null> {
  return (await getCurrentUser())?.role ?? null;
}

export async function requireRole(allowedRoles: readonly AuthRole[]): Promise<DemoSession | null> {
  const session = await getCurrentUser();
  return hasRole(session?.role ?? null, allowedRoles) ? session : null;
}
