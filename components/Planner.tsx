"use client";

/**
 * Today's task list + a reminder strip of yesterday's unfinished tasks.
 * Mutations go to the FastAPI backend; `onChanged` tells the parent
 * (dashboard) to refetch so the widgets stay in sync.
 */

import { FormEvent, useState } from "react";
import { api, Task } from "@/lib/api";
import { IconSun } from "@/components/icons";

export function Planner({
  todayTasks,
  yesterdayTasks,
  onChanged,
}: {
  todayTasks: Task[];
  yesterdayTasks: Task[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  // Wraps a mutation: disables the UI, runs it, then refreshes the parent.
  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    void mutate(async () => {
      await api.planner.add(t);
      setTitle("");
    });
  }

  return (
    <section className="panel">
      <h2 className="section-title label-with-icon">
        <IconSun className="card-icon" size={18} />
        Today
      </h2>
      <p className="section-lede">What needs doing before the day dissolves.</p>

      {yesterdayTasks.length > 0 && (
        <div className="reminder-strip">
          <div className="msg-label">still open from yesterday</div>
          <ul className="task-list muted">
            {yesterdayTasks.map((t) => (
              <li key={t.id}>{t.title}</li>
            ))}
          </ul>
        </div>
      )}

      <ul className="task-list">
        {todayTasks.map((t) => (
          <li key={t.id} className={t.done ? "done" : undefined}>
            <label className="task-row">
              <input
                type="checkbox"
                checked={t.done}
                disabled={busy}
                onChange={(e) => void mutate(() => api.planner.toggle(t.id, e.target.checked))}
              />
              <span>{t.title}</span>
            </label>
            <button
              type="button"
              className="ghost-btn"
              disabled={busy}
              onClick={() => void mutate(() => api.planner.remove(t.id))}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      <form className="inline-form" onSubmit={onAdd}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task…"
        />
        <button type="submit" disabled={busy || !title.trim()}>
          Add
        </button>
      </form>
    </section>
  );
}
