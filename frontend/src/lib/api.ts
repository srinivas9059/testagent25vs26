import type { BoardData } from "./kanban";

export type Snapshot = { board: BoardData; revision: number };
export type Message = { role: "user" | "assistant"; content: string };
export type ChatReply = { reply: string; boardUpdated: boolean };

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { cache: "no-store", ...init });
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(
      response.status,
      typeof data?.detail === "string" ? data.detail : "The request failed. Try again."
    );
  }
  return response.json() as Promise<T>;
}

export function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
