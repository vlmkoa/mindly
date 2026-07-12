"use client";

/**
 * Month-calendar planner. One fetch per visible month (the range endpoint);
 * clicking a day opens a detail panel with the same add/toggle/delete
 * interactions as the daily planner on Home.
 */

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, Task, localToday } from "@/lib/api";

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function dateKey(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/**
 * Cells for a Mon–Sun grid covering the month, padded with the neighboring
 * months' days so every row has 7 cells.
 */
function buildMonthCells(year: number, month: number): { key: string; day: number; outside: boolean }[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // days shown from the previous month
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: { key: string; day: number; outside: boolean }[] = [];

  for (let i = lead; i > 0; i--) {
    const d = new Date(year, month, 1 - i);
    cells.push({ key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ key: dateKey(year, month, d), day: d, outside: false });
  }
  for (let i = 1; cells.length % 7 !== 0; i++) {
    // Trailing days spill into the next month.
    const d = new Date(year, month + 1, i);
    cells.push({ key: dateKey(d.getFullYear(), d.getMonth(), d.getDate()), day: d.getDate(), outside: true });
  }
  return cells;
}

function humanDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export function MonthPlanner() {
  const today = localToday();
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [month, setMonth] = useState(() => new Date().getMonth()); // 0-based
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selected, setSelected] = useState<string>(today);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const cells = useMemo(() => buildMonthCells(year, month), [year, month]);

  const reload = useCallback(() => {
    // The grid shows spillover days, so fetch the full visible range.
    const start = cells[0].key;
    const end = cells[cells.length - 1].key;
    api.planner
      .range(start, end)
      .then(setTasks)
      .catch((e) => setError(e?.message ?? "Could not load."));
  }, [cells]);

  useEffect(() => {
    reload();
  }, [reload]);

  const byDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const t of tasks) {
      const list = map.get(t.date) ?? [];
      list.push(t);
      map.set(t.date, list);
    }
    return map;
  }, [tasks]);

  function shiftMonth(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  async function mutate(fn: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await fn();
      reload();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t) return;
    void mutate(async () => {
      await api.planner.add(t, selected);
      setTitle("");
    });
  }

  const monthTitle = new Date(year, month, 1).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });
  const selectedTasks = byDate.get(selected) ?? [];

  return (
    <section className="panel">
      <div className="cal-head">
        <div className="cal-title">{monthTitle}</div>
        <div className="cal-nav">
          <button type="button" className="chip" onClick={() => shiftMonth(-1)}>
            ← prev
          </button>
          <button
            type="button"
            className="chip"
            onClick={() => {
              const d = new Date();
              setYear(d.getFullYear());
              setMonth(d.getMonth());
              setSelected(today);
            }}
          >
            today
          </button>
          <button type="button" className="chip" onClick={() => shiftMonth(1)}>
            next →
          </button>
        </div>
      </div>

      {error && <div className="form-error">{error}</div>}

      <div className="cal-grid">
        {DOW.map((d) => (
          <div key={d} className="cal-dow">
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const dayTasks = byDate.get(c.key) ?? [];
          const classes = [
            "cal-cell",
            c.outside && "outside",
            c.key === today && "today",
            c.key === selected && "selected",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={c.key}
              type="button"
              className={classes}
              onClick={() => setSelected(c.key)}
            >
              <span className="cal-daynum">{c.day}</span>
              {dayTasks.slice(0, 3).map((t) => (
                <span key={t.id} className={t.done ? "cal-task done" : "cal-task"}>
                  {t.title}
                </span>
              ))}
              {dayTasks.length > 3 && (
                <span className="cal-more">+{dayTasks.length - 3} more</span>
              )}
              {/* On narrow screens the titles are hidden — show a count instead. */}
              {dayTasks.length > 0 && (
                <span className="cal-more cal-count-mobile">
                  {dayTasks.filter((t) => t.done).length}/{dayTasks.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="day-detail">
        <div className="day-detail-title">{humanDate(selected)}</div>
        <p className="section-lede">
          {selected === today
            ? "Also shown on the home page."
            : selected < today
              ? "A day already gone."
              : "A day still to come."}
        </p>

        {selectedTasks.length === 0 ? (
          <p className="hint">nothing planned</p>
        ) : (
          <ul className="task-list">
            {selectedTasks.map((t) => (
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
        )}

        <form className="inline-form" onSubmit={onAdd}>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Add a task for ${humanDate(selected)}…`}
          />
          <button type="submit" disabled={busy || !title.trim()}>
            Add
          </button>
        </form>
      </div>
    </section>
  );
}
