"use client";

/**
 * Journal page: today's entry (editable all day) + month-grouped history.
 * The browser decides what "today" is (localToday), matching the backend's
 * date-string convention.
 */

import { useCallback, useEffect, useState } from "react";
import { api, JournalEntryDto, localToday } from "@/lib/api";
import { JournalNotebook } from "@/components/JournalNotebook";
import { GuestPeek } from "@/components/GuestGate";
import { useAuthUser } from "@/components/AppShell";

/** Consecutive-day streak ending today (or yesterday if today unwritten). */
function computeStreak(dates: string[]): number {
  const set = new Set(dates);
  const cursor = new Date();
  if (!set.has(localToday())) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  for (;;) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(
      cursor.getDate()
    ).padStart(2, "0")}`;
    if (!set.has(key)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function JournalPage() {
  const user = useAuthUser();
  const [entries, setEntries] = useState<JournalEntryDto[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api.journal
      .list()
      .then(setEntries)
      .catch((e) => setError(e?.message ?? "Could not load journal."));
  }, []);

  useEffect(() => {
    if (!user) return; // guests see the gate, not a failed fetch
    reload();
  }, [reload, user]);

  const today = localToday();
  const todayEntry = entries?.find((e) => e.date === today) ?? null;
  const streak = entries ? computeStreak(entries.map((e) => e.date)) : 0;

  return (
    <>
      <header>
        <div className="title">Journal</div>
        <div className="subtitle">A page that clears itself each morning.</div>
        <div className="streak-badge">
          {streak > 0 ? `${streak}-day streak` : "no streak yet"}
          {todayEntry ? " · today written" : " · today empty"}
        </div>
      </header>

      <div className="page-body">
        {user === null && (
          // Sneak peek: the real (empty) notebook under an interaction shield.
          <GuestPeek feature="The journal">
            <JournalNotebook entries={[]} streak={0} onSaved={reload} />
          </GuestPeek>
        )}
        {error && <div className="form-error">{error}</div>}
        {entries && (
          // The notebook owns everything: today's editable page (last page),
          // read-only pages for past days, page-turning, and the month index.
          <JournalNotebook entries={entries} streak={streak} onSaved={reload} />
        )}
      </div>
    </>
  );
}
