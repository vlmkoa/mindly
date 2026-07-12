"use client";

/** Read-only history: reverse-chronological entries grouped by month. */

import { useState } from "react";
import { monthLabel } from "@/lib/dates";
import { JournalEntryDto } from "@/lib/api";

export function JournalHistory({ entries }: { entries: JournalEntryDto[] }) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (entries.length === 0) {
    return (
      <div className="empty-panel">
        <div className="empty-text">No past entries yet.</div>
      </div>
    );
  }

  // Group by YYYY-MM; entries arrive newest-first from the API.
  const groups = new Map<string, JournalEntryDto[]>();
  for (const e of entries) {
    const key = e.date.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(e);
  }

  return (
    <section className="panel">
      <h2 className="section-title">History</h2>
      <p className="section-lede">Revisit the path, month by month.</p>
      {Array.from(groups.entries()).map(([ym, list]) => (
        <div key={ym} className="history-month">
          <div className="month-label">{monthLabel(list[0].date)}</div>
          <ul className="history-list">
            {list.map((e) => {
              const open = openId === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    className="history-row"
                    onClick={() => setOpenId(open ? null : e.id)}
                  >
                    <span className="history-date">{e.date}</span>
                    <span className="history-mode">{e.mode}</span>
                  </button>
                  {open && (
                    <div className="history-body">
                      {e.mode === "free" ? (
                        <p className="msg-text">{e.freeText || "—"}</p>
                      ) : (
                        <>
                          <div className="prompt-read">
                            <div className="msg-label">succeeded</div>
                            <p>{e.successes || "—"}</p>
                          </div>
                          <div className="prompt-read">
                            <div className="msg-label">failed</div>
                            <p>{e.failures || "—"}</p>
                          </div>
                          <div className="prompt-read">
                            <div className="msg-label">tomorrow</div>
                            <p>{e.intentions || "—"}</p>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </section>
  );
}
