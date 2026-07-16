"use client";

/**
 * Persistent "now playing" bar for a meditation session — fixed at the bottom of
 * every page (like a streaming player) whenever a session is active. Reads and
 * controls the global MeditationProvider, so it works from any tab.
 */

import { useEffect } from "react";
import { useMeditation } from "@/components/MeditationProvider";
import { formatTimer } from "@/components/CountdownTimer";

export function MeditationBar() {
  const { session, pause, resume, end } = useMeditation();

  // Reserve space at the bottom of the page so the fixed bar never hides content.
  useEffect(() => {
    if (!session) return;
    document.body.classList.add("has-med-bar");
    return () => document.body.classList.remove("has-med-bar");
  }, [session]);

  if (!session) return null;

  const elapsed = session.totalSec - session.remainingSec;
  const progress = session.totalSec > 0 ? Math.min(1, elapsed / session.totalSec) : 0;

  return (
    <div className="med-bar" role="region" aria-label="Meditation session">
      <div className="med-bar-inner">
        <div className="med-bar-meta">
          <span className="med-bar-title">meditation</span>
          <span className="med-bar-label">{session.label}</span>
        </div>

        <div className="med-bar-progress">
          <div className="med-bar-track">
            <div className="med-bar-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="med-bar-time">
            {formatTimer(session.remainingSec)}{session.paused ? " paused" : " left"}
          </span>
        </div>

        <div className="med-bar-controls">
          <button
            type="button"
            className="med-bar-btn"
            onClick={session.paused ? resume : pause}
          >
            {session.paused ? "▶ resume" : "⏸ pause"}
          </button>
          <button type="button" className="med-bar-btn med-bar-end" onClick={end}>
            ■ end
          </button>
        </div>
      </div>
    </div>
  );
}
