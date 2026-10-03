"use client";

import { useEffect, useState } from "react";
import { clearLegacyDemoAuth } from "@/lib/demo-auth";
import { isDemoSession, type DemoSession } from "@/lib/auth-types";

export function useDemoSession() {
  const [session, setSession] = useState<DemoSession | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const refreshSession = async () => {
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (!response.ok) throw new Error(`Session check failed with status ${response.status}.`);
        const payload: unknown = await response.json();
        if (typeof payload !== "object" || payload === null || !("session" in payload)) {
          throw new Error("Session check returned an invalid response.");
        }

        const nextSession = payload.session === null
          ? null
          : isDemoSession(payload.session)
            ? payload.session
            : (() => { throw new Error("Session check returned an invalid session."); })();

        if (active) {
          setSession(nextSession);
          setError(null);
          setReady(true);
        }
      } catch (cause) {
        console.error("Unable to verify the Lumina demo session.", cause);
        if (active) {
          setSession(null);
          setError("Unable to verify your session. Refresh the page and try again.");
          setReady(true);
        }
      }
    };

    clearLegacyDemoAuth();
    void refreshSession();
    window.addEventListener("lumina-auth-change", refreshSession);
    window.addEventListener("focus", refreshSession);
    return () => {
      active = false;
      window.removeEventListener("lumina-auth-change", refreshSession);
      window.removeEventListener("focus", refreshSession);
    };
  }, []);

  return { session, ready, error };
}
