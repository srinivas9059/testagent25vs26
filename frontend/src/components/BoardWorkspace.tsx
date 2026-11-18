"use client";

import { useEffect, useRef, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ApiError, json, request, type ChatReply, type Message, type Snapshot } from "@/lib/api";
import type { BoardData } from "@/lib/kanban";

export function BoardWorkspace({ onSessionExpired }: { onSessionExpired: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"save" | "chat" | null>(null);
  const locked = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    request<Snapshot>("/api/board", { signal: controller.signal }).then(
      (data) => {
        if (!controller.signal.aborted) setSnapshot(data);
      },
      (error: unknown) => {
        if (controller.signal.aborted) return;
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else setError("Couldn't load the board.");
      }
    );
    return () => controller.abort();
  }, [loadAttempt, onSessionExpired]);

  async function refresh() {
    try {
      setSnapshot(await request<Snapshot>("/api/board"));
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      setSnapshot(null);
      return false;
    }
  }

  async function save(board: BoardData) {
    if (!snapshot || locked.current) return;
    locked.current = true;
    setBusy("save");
    setError("");
    try {
      setSnapshot(await request<Snapshot>("/api/board", json("PUT", { ...snapshot, board })));
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        onSessionExpired();
      } else if (error instanceof ApiError && error.status === 409) {
        const loaded = await refresh();
        setError(loaded
          ? "The board changed. Your edit was not saved. The latest board is shown."
          : "The board changed. Your edit was not saved. Reload the board to continue.");
      } else {
        setError("Your edit was not saved. Try again.");
      }
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  async function send(message: string, history: Message[]) {
    if (!snapshot || locked.current) throw new Error("Wait for the board to finish loading or saving.");
    locked.current = true;
    setBusy("chat");
    setError("");
    try {
      const reply = await request<ChatReply>("/api/chat", json("POST", { message, history }));
      if (reply.boardUpdated && !(await refresh())) {
        setError("The AI saved its changes. Reload the board to see them.");
      }
      return reply;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      if (error instanceof ApiError && error.status === 409 && !(await refresh())) {
        setError("Reload the board to continue.");
      }
      throw error;
    } finally {
      locked.current = false;
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto grid max-w-[1680px] items-start gap-6 px-4 pb-12 pt-4 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="min-w-0" aria-label="Kanban board">
        <header className="mb-5 flex flex-wrap items-end justify-between gap-3 rounded-3xl border border-[var(--stroke)] bg-white px-6 py-5 shadow-[var(--shadow)]">
          <h1 className="font-display text-3xl font-semibold tracking-tight">Kanban Studio</h1>
          {busy === "save" && <p role="status" className="text-sm">Saving board…</p>}
        </header>
        {error && <p role="alert" className="mb-4 rounded-xl bg-amber-50 p-3 text-amber-950">{error}</p>}
        {snapshot ? (
          <KanbanBoard board={snapshot.board} onChange={save} locked={busy !== null} />
        ) : error ? (
          <button type="button" className="rounded-xl bg-white px-4 py-2 font-semibold shadow-sm" onClick={() => {
            setError("");
            setLoadAttempt((count) => count + 1);
          }}>Reload board</button>
        ) : (
          <p role="status">Loading board…</p>
        )}
      </section>
      <ChatSidebar disabled={!snapshot || busy !== null} onSend={send} />
    </main>
  );
}
