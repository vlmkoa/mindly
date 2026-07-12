/**
 * Frontend API client — the only place that talks HTTP to the FastAPI backend.
 *
 * All requests go to /api/* on the SAME origin; next.config.js rewrites them
 * to the backend container (localhost:8000). Same-origin means the session
 * cookie flows automatically and no CORS setup is needed.
 *
 * Error convention: non-2xx responses throw ApiError with the backend's
 * `detail` message, and a 401 anywhere means "not logged in" — callers
 * usually redirect to /login on it.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    // Cookies ride along even though we're same-origin — explicit is safer.
    credentials: "include",
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (typeof body?.detail === "string") detail = body.detail;
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(res.status, detail);
  }

  // Some endpoints return {ok:true}; all are JSON except the chat stream
  // (which doesn't go through this helper).
  return res.json() as Promise<T>;
}

// ─── Local-date helpers (the browser owns "what day is it") ─────────────────

export function localToday(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// ─── Types mirrored from backend/schemas.py (camelCase via alias) ────────────

export type User = { id: string; email: string; name: string };

export type Task = { id: string; date: string; title: string; done: boolean };

export type Relapse = { id: string; occurredAt: string; previousStart: string };

export type AddictionDto = {
  id: string;
  type: string;
  label: string;
  sobrietyStart: string;
  relapses: Relapse[];
};

export type JournalEntryDto = {
  id: string;
  date: string;
  mode: "free" | "prompted";
  freeText: string | null;
  successes: string | null;
  failures: string | null;
  intentions: string | null;
};

export type Dashboard = {
  todayTasks: Task[];
  yesterdayTasks: Task[];
  meditationWeekMinutes: number;
  meditationDayBars: { date: string; minutes: number }[];
  addictions: AddictionDto[];
  journalTodayDone: boolean;
  journalStreak: number;
  koanSessionsThisWeek: number;
};

// ─── Auth ────────────────────────────────────────────────────────────────────

export const api = {
  auth: {
    signup: (body: { email: string; password: string; name?: string }) =>
      request<User>("/api/auth/signup", { method: "POST", body: JSON.stringify(body) }),
    login: (body: { email: string; password: string }) =>
      request<User>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
    logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
    /** Returns the user or throws ApiError(401) — used as the auth guard. */
    me: () => request<User>("/api/auth/me"),
  },

  dashboard: () =>
    request<Dashboard>(
      // Send local date + tz offset so streaks/bars use the user's calendar.
      `/api/dashboard?today=${localToday()}&tz_offset_min=${new Date().getTimezoneOffset()}`
    ),

  planner: {
    /** Adds a task; date defaults to today (home planner) but the calendar passes any day. */
    add: (title: string, date?: string) =>
      request<Task>("/api/planner/tasks", {
        method: "POST",
        body: JSON.stringify({ title, date: date ?? localToday() }),
      }),
    /** All tasks in an inclusive YYYY-MM-DD range — one call per calendar month. */
    range: (start: string, end: string) =>
      request<Task[]>(`/api/planner/tasks?start=${start}&end=${end}`),
    toggle: (id: string, done: boolean) =>
      request<Task>(`/api/planner/tasks/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ done }),
      }),
    remove: (id: string) =>
      request<{ ok: true }>(`/api/planner/tasks/${id}`, { method: "DELETE" }),
  },

  sobriety: {
    list: () => request<AddictionDto[]>("/api/sobriety/addictions"),
    start: (type: string, label: string) =>
      request<AddictionDto>("/api/sobriety/addictions", {
        method: "POST",
        body: JSON.stringify({ type, label }),
      }),
    relapse: (id: string) =>
      request<AddictionDto>(`/api/sobriety/addictions/${id}/relapse`, { method: "POST" }),
    stop: (id: string) =>
      request<{ ok: true }>(`/api/sobriety/addictions/${id}/stop`, { method: "POST" }),
  },

  journal: {
    list: () => request<JournalEntryDto[]>("/api/journal/entries"),
    upsert: (body: {
      mode: "free" | "prompted";
      freeText?: string | null;
      successes?: string | null;
      failures?: string | null;
      intentions?: string | null;
    }) =>
      request<JournalEntryDto>("/api/journal/entries", {
        method: "PUT",
        body: JSON.stringify({ ...body, date: localToday() }),
      }),
  },

  meditation: {
    save: (body: { kind: "free" | "guided"; durationSec: number; soundConfig?: string }) =>
      request<{ ok: true }>("/api/meditation/sessions", {
        method: "POST",
        body: JSON.stringify(body),
      }),
  },

  koan: {
    bump: () => request<{ ok: true }>("/api/koan/bump", { method: "POST" }),
  },
};
