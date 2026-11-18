"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ApiError, type ChatReply, type Message } from "@/lib/api";

const historyKey = "kanban-studio-chat";

export function clearChatHistory() {
  try {
    sessionStorage.removeItem(historyKey);
  } catch {
    // Storage can be disabled by the browser.
  }
}

type Props = {
  disabled: boolean;
  onSend: (message: string, history: Message[]) => Promise<ChatReply>;
};

export function ChatSidebar({ disabled, onSend }: Props) {
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(historyKey) ?? "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages, pending]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = draft.trim();
    if (!message || disabled || pending) return;
    setPending(message);
    setError("");
    setNotice("");
    try {
      const result = await onSend(message, messages);
      const next: Message[] = [
        ...messages,
        { role: "user", content: message },
        { role: "assistant", content: result.reply },
      ];
      const recent = next.slice(-20);
      setMessages(recent);
      setDraft("");
      if (result.boardUpdated) setNotice("Board updated.");
      try {
        if (log.current) sessionStorage.setItem(historyKey, JSON.stringify(recent));
      } catch {
        // The conversation remains available in this tab.
      }
    } catch (error) {
      setError(error instanceof ApiError ? error.message : "Couldn't reach the AI. Try again.");
    } finally {
      setPending("");
    }
  }

  return (
    <aside aria-labelledby="chat-title" className="flex flex-col overflow-hidden rounded-3xl border border-[var(--stroke)] bg-white shadow-[var(--shadow)] xl:sticky xl:top-6">
      <header className="border-t-4 border-[var(--accent-yellow)] bg-[var(--navy-dark)] px-5 py-4 text-white">
        <h2 id="chat-title" className="font-display text-xl font-semibold">AI chat</h2>
        <p className="mt-1 text-sm text-blue-100">Ask about your board or request a card change.</p>
      </header>
      <div ref={log} role="log" aria-label="Conversation" className="grid max-h-[min(46vh,25rem)] min-h-36 content-start gap-3 overflow-y-auto px-4 py-4 text-sm">
        {messages.length === 0 && !pending && (
          <p className="leading-relaxed text-slate-600">Try “Which cards are in review?”</p>
        )}
        {messages.map((message, index) => (
          <p key={index} className={`whitespace-pre-wrap [overflow-wrap:anywhere] rounded-2xl px-3 py-2.5 leading-relaxed ${
            message.role === "user" ? "ml-5 bg-blue-50" : "mr-5 bg-[var(--surface)]"
          }`}>
            <span className="mb-1 block font-semibold">{message.role === "user" ? "You" : "Assistant"}</span>
            {message.content}
          </p>
        ))}
        {pending && (
          <>
            <p className="ml-5 whitespace-pre-wrap rounded-2xl bg-blue-50 px-3 py-2.5 [overflow-wrap:anywhere]">
              <span className="mb-1 block font-semibold">You</span>
              {pending}
            </p>
            <p role="status" className="text-slate-600">Assistant is working…</p>
          </>
        )}
      </div>
      <form onSubmit={submit} className="grid gap-3 border-t border-[var(--stroke)] p-4">
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        {notice && <p role="status" className="text-sm font-semibold text-emerald-800">{notice}</p>}
        <label className="grid gap-1.5 text-sm font-semibold">
          Message
          <textarea value={draft} onChange={(event) => setDraft(event.target.value)}
            rows={3} maxLength={8000} required readOnly={!!pending}
            className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 font-normal focus:border-[var(--primary-blue)] focus:outline-none"
            placeholder="Ask or request a change" />
        </label>
        <button type="submit" disabled={disabled || !!pending || !draft.trim()}
          className="justify-self-end rounded-xl bg-[var(--secondary-purple)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          Send
        </button>
        <p className="text-xs leading-relaxed text-slate-600">Chat sends the board and conversation to OpenRouter. Use demo data you can share.</p>
      </form>
    </aside>
  );
}
