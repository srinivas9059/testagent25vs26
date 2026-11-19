"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { BoardWorkspace } from "@/components/BoardWorkspace";
import { clearChatHistory } from "@/components/ChatSidebar";

type SessionState = "checking" | "signedOut" | "signedIn" | "unavailable";

const actionClass =
  "rounded-xl bg-[var(--secondary-purple)] px-4 py-2.5 font-semibold text-white disabled:opacity-60";

export function Workspace() {
  const [session, setSession] = useState<SessionState>("checking");
  const [checks, setChecks] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const endSession = useCallback(() => {
    clearChatHistory();
    setSession("signedOut");
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", { cache: "no-store", signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        if (response.ok) {
          setSession("signedIn");
        } else if (response.status === 401) {
          endSession();
        } else {
          setSession("unavailable");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setSession("unavailable");
      });
    return () => controller.abort();
  }, [checks, endSession]);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: formData.get("username"),
          password: formData.get("password"),
        }),
      });
      if (response.status === 401) {
        setError("Incorrect username or password.");
      } else if (response.ok) {
        clearChatHistory();
        setSession("signedIn");
      } else {
        setError("Couldn't sign in. Try again.");
      }
    } catch {
      setError("Couldn't sign in. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function signOut() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Sign-out failed");
      endSession();
    } catch {
      setError("Couldn't sign out. Try again.");
    } finally {
      setPending(false);
    }
  }

  if (session === "signedIn") {
    return (
      <>
        <div className="mx-auto flex max-w-[1680px] flex-wrap items-center justify-end gap-3 px-4 pt-4 sm:px-6">
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className={actionClass}
          >
            {pending ? "Signing out…" : "Sign out"}
          </button>
        </div>
        <BoardWorkspace onSessionExpired={endSession} />
      </>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center px-6 py-12">
      <section className="w-full max-w-md rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
        <h1 className="font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Kanban Studio
        </h1>
        {session === "checking" && (
          <p className="mt-4" role="status">Checking your session…</p>
        )}
        {session === "unavailable" && (
          <>
            <p className="mt-4" role="alert">Couldn&apos;t check your session.</p>
            <button
              type="button"
              className={`mt-4 ${actionClass}`}
              onClick={() => {
                setSession("checking");
                setChecks((count) => count + 1);
              }}
            >
              Try again
            </button>
          </>
        )}
        {session === "signedOut" && (
          <form className="mt-6 grid gap-4" onSubmit={signIn}>
            <label className="grid gap-1 font-medium">
              Username
              <input
                className="rounded-xl border border-[var(--stroke)] px-3 py-2"
                name="username"
                autoComplete="username"
                required
              />
            </label>
            <label className="grid gap-1 font-medium">
              Password
              <input
                className="rounded-xl border border-[var(--stroke)] px-3 py-2"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && <p role="alert">{error}</p>}
            <button className={actionClass} disabled={pending} type="submit">
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
