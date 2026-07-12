"use client";

/**
 * Journal page: today's entry (editable all day) + month-grouped history.
 * The browser decides what "today" is (localToday), matching the backend's
 * date-string convention.
 */

import { useCallback, useEffect, useState } from "react";
import { api, JournalEntryDto, localToday } from "@/lib/api";
import { TodayJournal } from "@/components/TodayJournal";
import { JournalHistory } from "@/components/JournalHistory";

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
  const [entries, setEntries] = useState<JournalEntryDto[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api.journal
      .list()
      .then(setEntries)
      .catch((e) => setError(e?.message ?? "Could not load journal."));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const today = localToday();
  const todayEntry = entries?.find((e) => e.date === today) ?? null;
  const history = entries?.filter((e) => e.date !== today) ?? [];
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
        {error && <div className="form-error">{error}</div>}
        {entries && (
          <>
            <TodayJournal
              // key forces a re-mount when the entry arrives so the editor
              // initializes from the saved values.
              key={todayEntry?.id ?? "new"}
              initial={todayEntry}
              onSaved={reload}
            />
            <JournalHistory entries={history} />
          </>
        )}
      </div>
    </>
  );
}
