"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LockKeyhole, Sparkles } from "lucide-react";
import { type FormEvent, useState, useSyncExternalStore } from "react";
import { FaceIdPanel } from "@/components/auth/FaceIdPanel";
import { DEMO_ACCOUNTS, notifyDemoAuthChange, REMEMBERED_EMAIL_KEY } from "@/lib/demo-auth";
import { dashboardForRole, isDemoSession, type DemoSession } from "@/lib/auth-types";

function subscribeRememberedEmail(callback: () => void): () => void {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function getRememberedEmail(): string {
  return window.localStorage.getItem(REMEMBERED_EMAIL_KEY) ?? "";
}

export default function AuthPage() {
  const router = useRouter();
  const rememberedEmail = useSyncExternalStore(subscribeRememberedEmail, getRememberedEmail, () => "");
  const [identifier, setIdentifier] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [passwordMode, setPasswordMode] = useState(false);
  const [setupUser, setSetupUser] = useState<DemoSession | null>(null);
  const [faceMode, setFaceMode] = useState<"register" | "login" | null>(null);
  const [faceAttempt, setFaceAttempt] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const identifierValue = identifier ?? rememberedEmail;
  const rememberMeChecked = rememberMe ?? Boolean(rememberedEmail);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: identifierValue, password }),
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        setError(`Sign-in service returned an invalid response (HTTP ${response.status}). Please try again.`);
        return;
      }

      if (!response.ok) {
        const serverError =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : null;
        setError(response.status === 401
          ? "Invalid email or password. Check the demo accounts and try again."
          : serverError ?? `Unable to sign in (HTTP ${response.status}). Please try again.`);
        return;
      }
      if (
        typeof payload !== "object" ||
        payload === null ||
        !("session" in payload) ||
        !isDemoSession(payload.session)
      ) {
        throw new Error("Sign-in returned an invalid authenticated session.");
      }

      const { session } = payload;
      if (rememberMeChecked) window.localStorage.setItem(REMEMBERED_EMAIL_KEY, session.user.email);
      else window.localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      notifyDemoAuthChange();
      let faceRegistered = true;
      try {
        const faceStatus = await fetch("/api/auth/face/status", { cache: "no-store" });
        if (!faceStatus.ok) throw new Error(`Face ID status failed with ${faceStatus.status}.`);
        const facePayload: unknown = await faceStatus.json();
        if (
          typeof facePayload !== "object" ||
          facePayload === null ||
          !("registered" in facePayload) ||
          typeof facePayload.registered !== "boolean"
        ) {
          throw new Error("Face ID status returned an invalid response.");
        }
        faceRegistered = facePayload.registered;
      } catch (cause) {
        console.error("Unable to check Face ID enrollment after password login.", cause);
        setNotice("Signed in, but Face ID setup status could not be checked.");
      }
      if (!faceRegistered) {
        setSetupUser(session);
        setPasswordMode(false);
        return;
      }
      router.replace(dashboardForRole(session.role));
    } catch (cause) {
      console.error("Lumina demo sign-in failed.", cause);
      setError("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const showForgotPasswordMessage = () => {
    setNotice("Password reset is not available in demo mode. Use one of the demo account credentials below.");
    setError("");
  };

  const fillAccount = (email: string, passwordValue: string) => {
    setIdentifier(email);
    setPassword(passwordValue);
    setError("");
    setNotice("");
  };

  const openFacePanel = (mode: "register" | "login") => {
    setError("");
    setNotice("");
    setFaceAttempt(0);
    setFaceMode(mode);
  };

  const completeFaceLogin = (session: DemoSession) => {
    setFaceMode(null);
    notifyDemoAuthChange();
    router.replace(dashboardForRole(session.role));
  };

  const completeFaceRegistration = () => {
    setFaceMode(null);
    setNotice("Face ID setup completed.");
    if (setupUser) {
      window.setTimeout(() => router.replace(dashboardForRole(setupUser.role)), 500);
    }
    setSetupUser(null);
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[30px] border border-white/10 bg-[#0d1516]/95 shadow-[0_28px_100px_rgba(0,0,0,0.45)] lg:grid-cols-[0.9fr_1.1fr]">
        <section className="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-emerald-300/[0.09] via-[#101919] to-cyan-300/[0.04] p-10 lg:flex">
          <div>
            <Link href="/" className="inline-flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-200/20 bg-emerald-300/10 text-emerald-200"><Sparkles className="h-5 w-5" /></span>
              <span className="text-lg font-semibold text-white">Lumina AI</span>
            </Link>
            <p className="mt-16 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200/80">Academic early warning system</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-white">Predict.<br />Explain.<br /><span className="text-emerald-200">Recover.</span></h1>
            <p className="mt-5 max-w-sm text-sm leading-7 text-zinc-400">Sign in to explore the Lumina AI demo workspace for students, faculty, mentors, and academic leadership.</p>
          </div>
          <p className="text-xs text-zinc-600">Frontend-only hackathon demonstration</p>
        </section>

        <section className="p-6 sm:p-10">
          <div className="mb-8 flex items-center justify-between gap-3">
            <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-white lg:hidden"><Sparkles className="h-4 w-4 text-emerald-200" />Lumina AI</Link>
            <span className="inline-flex rounded-full border border-emerald-200/15 bg-emerald-200/[0.06] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-emerald-100">LUMINA AI • DEMO MODE</span>
          </div>
          <div className="mb-7">
            <p className="text-sm text-zinc-400">Welcome back</p>
            <h2 className="mt-1 text-3xl font-semibold text-white">Sign in to Lumina</h2>
            <p className="mt-2 text-sm text-zinc-500">
              {setupUser
                ? "Set up Face ID for faster login next time."
                : "Use Face ID or sign in with your email and password."}
            </p>
          </div>

          {setupUser ? (
            <div className="space-y-3 rounded-xl border border-emerald-200/20 bg-emerald-200/[0.05] p-4">
              <p role="status" className="text-sm text-emerald-100">Set up Face ID for faster login next time.</p>
              <p className="text-xs leading-5 text-zinc-400">Your live camera frames are processed in this browser. Lumina stores only encrypted face-recognition descriptors, never photos or recordings.</p>
              <button
                type="button"
                onClick={() => openFacePanel("register")}
                className="flex h-11 w-full items-center justify-center rounded-xl bg-emerald-200 px-4 text-sm font-semibold text-[#10201a] transition hover:bg-emerald-100"
              >
                Register Face ID
              </button>
              <button
                type="button"
                onClick={() => router.replace(dashboardForRole(setupUser.role))}
                className="h-9 w-full text-sm text-zinc-400 hover:text-white"
              >
                Skip for now
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => openFacePanel("login")}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-200 px-4 text-sm font-semibold text-[#10201a] transition hover:bg-emerald-100"
              >
                Login with Face ID
              </button>
              {!passwordMode ? (
                <button
                  type="button"
                  onClick={() => { setPasswordMode(true); setError(""); setNotice(""); }}
                  className="h-10 w-full rounded-xl border border-white/10 px-4 text-sm text-zinc-300 transition hover:border-emerald-200/25 hover:text-white"
                >
                  Use Email &amp; Password
                </button>
              ) : null}
            </div>
          )}

          {passwordMode && !setupUser ? (
          <form onSubmit={onSubmit} className="mt-4 space-y-4 border-t border-white/10 pt-4">
            <div>
              <label htmlFor="identifier" className="mb-2 block text-sm font-medium text-zinc-300">Email / Student ID</label>
              <input
                id="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifierValue}
                onChange={(event) => setIdentifier(event.target.value)}
                placeholder="you@lumina.demo"
                className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] px-4 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-200/40"
              />
            </div>
            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-zinc-300">Password</label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.035] pl-11 pr-12 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-emerald-200/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-zinc-400 transition hover:text-white"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 text-xs">
              <label className="inline-flex items-center gap-2 text-zinc-400">
                <input type="checkbox" checked={rememberMeChecked} onChange={(event) => setRememberMe(event.target.checked)} className="accent-emerald-300" />
                Remember me
              </label>
              <button type="button" onClick={showForgotPasswordMessage} className="text-emerald-200 transition hover:text-white">Forgot password?</button>
            </div>

            {error ? <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2.5 text-sm text-rose-200">{error}</p> : null}
            {notice ? <p role="status" className="rounded-xl border border-amber-200/20 bg-amber-200/[0.06] px-3 py-2.5 text-sm text-amber-100">{notice}</p> : null}

            <button
              type="submit"
              disabled={loading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-200 px-4 text-sm font-semibold text-[#10201a] transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-70"
            >
              {loading ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-[#10201a]/30 border-t-[#10201a]" />Signing in…</> : "Login"}
            </button>
            <button
              type="button"
              onClick={() => { setPasswordMode(false); setError(""); setNotice(""); }}
              className="h-9 w-full text-sm text-zinc-400 hover:text-white"
            >
              Back to Face ID
            </button>
          </form>
          ) : null}

          {passwordMode && !setupUser ? (
          <div className="mt-7 border-t border-white/10 pt-5">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">Demo accounts · click to fill</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.role}
                  type="button"
                  onClick={() => fillAccount(account.email, account.password)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-2.5 text-left transition hover:border-emerald-200/25 hover:bg-emerald-200/[0.04]"
                >
                  <span><span className="block text-xs font-medium text-zinc-200">{account.role}</span><span className="mt-0.5 block text-[10px] text-zinc-500">{account.email}</span></span>
                  <span className="text-[10px] text-emerald-200">Fill</span>
                </button>
              ))}
            </div>
            <p className="mt-3 text-center text-[10px] text-zinc-600">Passwords: student123 · faculty123 · mentor123 · hod123 · admin123</p>
          </div>
          ) : null}
        </section>
      </div>
      {faceMode ? (
        <FaceIdPanel
          mode={faceMode}
          attempt={faceAttempt}
          onClose={() => setFaceMode(null)}
          onRetry={() => setFaceAttempt((previous) => previous + 1)}
          onUsePassword={() => { setFaceMode(null); setPasswordMode(true); }}
          onRegistered={completeFaceRegistration}
          onAuthenticated={completeFaceLogin}
        />
      ) : null}
    </main>
  );
}
