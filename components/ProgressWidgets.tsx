"use client";

import Link from "next/link";
import { formatDuration } from "@/lib/dates";
import { useEffect, useState } from "react";
import { IconLeaf, IconLotus, IconPen, IconRipple } from "@/components/icons";

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="progress-track" aria-hidden>
      <div className="progress-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DayBars({ days }: { days: { date: string; minutes: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.minutes));
  return (
    <div className="day-bars">
      {days.map((d) => (
        <div key={d.date} className="day-bar-col" title={`${d.minutes} min`}>
          <div
            className="day-bar"
            style={{ height: `${Math.max(4, (d.minutes / max) * 48)}px` }}
          />
          <span className="day-bar-label">{d.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

function SoberDays({ start }: { start: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);
  const d = formatDuration(now - new Date(start).getTime());
  return <span>{d.days}d</span>;
}

export function ProgressWidgets({
  meditation,
  addictions,
  journal,
  koan,
}: {
  meditation: { weekMinutes: number; dayBars: { date: string; minutes: number }[] };
  addictions: { id: string; label: string; sobrietyStart: string }[];
  journal: { todayDone: boolean; streak: number };
  koan: { sessionsThisWeek: number };
}) {
  const medGoal = 70; // soft weekly goal for the bar

  return (
    <section className="widget-grid">
      <Link href="/meditate" className="widget-card">
        <div className="msg-label label-with-icon">
          <IconLotus className="card-icon" />
          Meditation
        </div>
        <div className="widget-stat">{meditation.weekMinutes} min this week</div>
        <ProgressBar value={meditation.weekMinutes} max={medGoal} />
        <DayBars days={meditation.dayBars} />
      </Link>

      <Link href="/sobriety" className="widget-card">
        <div className="msg-label label-with-icon">
          <IconLeaf className="card-icon" />
          Sobriety
        </div>
        {addictions.length === 0 ? (
          <div className="widget-stat muted">Nothing tracked</div>
        ) : (
          <ul className="widget-list">
            {addictions.map((a) => (
              <li key={a.id}>
                <span>{a.label}</span>
                <SoberDays start={a.sobrietyStart} />
              </li>
            ))}
          </ul>
        )}
      </Link>

      <Link href="/journal" className="widget-card">
        <div className="msg-label label-with-icon">
          <IconPen className="card-icon" />
          Journal
        </div>
        <div className="widget-stat">
          {journal.streak > 0 ? `${journal.streak}-day streak` : "Start a streak"}
        </div>
        <ProgressBar value={journal.todayDone ? 1 : 0} max={1} />
        <div className="hint">
          {journal.todayDone ? "today written" : "today still empty"}
        </div>
      </Link>

      <Link href="/koan" className="widget-card">
        <div className="msg-label label-with-icon">
          <IconRipple className="card-icon" />
          Koan
        </div>
        <div className="widget-stat">
          {koan.sessionsThisWeek} session{koan.sessionsThisWeek === 1 ? "" : "s"} this week
        </div>
        <ProgressBar value={koan.sessionsThisWeek} max={7} />
      </Link>
    </section>
  );
}
