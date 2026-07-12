"use client";

/**
 * One tracked addiction: live sober timer, longest-streak stat, reset/stop.
 */

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/dates";
import { api, AddictionDto } from "@/lib/api";

/** Longest streak = max over (ended streaks from relapse history, current run). */
function longestStreakMs(a: AddictionDto): number {
  const starts = [...a.relapses.map((r) => new Date(r.previousStart)), new Date(a.sobrietyStart)];
  const ends = [...a.relapses.map((r) => new Date(r.occurredAt)), new Date()];
  let best = 0;
  for (let i = 0; i < starts.length; i++) {
    best = Math.max(best, ends[i].getTime() - starts[i].getTime());
  }
  return best;
}

function LiveTimer({ start }: { start: string }) {
  // Ticks every second; cheap because it's a single component per card.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const d = formatDuration(now - new Date(start).getTime());
  return (
    <div className="sober-timer">
      <span className="sober-days">{d.days}</span>
      <span className="sober-unit">days</span>
      <span className="sober-hms">
        {String(d.hours).padStart(2, "0")}:{String(d.minutes).padStart(2, "0")}:
        {String(d.seconds).padStart(2, "0")}
      </span>
    </div>
  );
}

export function AddictionCard({
  addiction,
  onChanged,
}: {
  addiction: AddictionDto;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const best = formatDuration(longestStreakMs(addiction));

  async function run(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="addiction-card">
      <div className="addiction-label">{addiction.label}</div>
      <LiveTimer start={addiction.sobrietyStart} />
      <div className="hint">
        longest streak: {best.days}d {best.hours}h
        {addiction.relapses.length > 0
          ? ` · ${addiction.relapses.length} reset${addiction.relapses.length === 1 ? "" : "s"}`
          : ""}
      </div>
      <div className="action-row">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            // Destructive-ish: restarts the visible timer, so confirm.
            if (!confirm("Record a reset and restart the timer?")) return;
            void run(() => api.sobriety.relapse(addiction.id));
          }}
        >
          Reset
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(() => api.sobriety.stop(addiction.id))}
        >
          Stop tracking
        </button>
      </div>
    </div>
  );
}
