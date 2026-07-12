"use client";

/** Today's journal editor — free write or the three MVP prompts. */

import { useState } from "react";
import { api, JournalEntryDto } from "@/lib/api";

type Mode = "free" | "prompted";

export function TodayJournal({
  initial,
  onSaved,
}: {
  initial: JournalEntryDto | null;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "prompted");
  const [freeText, setFreeText] = useState(initial?.freeText ?? "");
  const [successes, setSuccesses] = useState(initial?.successes ?? "");
  const [failures, setFailures] = useState(initial?.failures ?? "");
  const [intentions, setIntentions] = useState(initial?.intentions ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api.journal.upsert({
        mode,
        // Only the active mode's fields are persisted; the other side is
        // cleared (matches the old upsert semantics).
        freeText: mode === "free" ? freeText : null,
        successes: mode === "prompted" ? successes : null,
        failures: mode === "prompted" ? failures : null,
        intentions: mode === "prompted" ? intentions : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel">
      <h2 className="section-title">Today</h2>
      <div className="duration-row">
        <button
          type="button"
          className={mode === "prompted" ? "chip active" : "chip"}
          onClick={() => setMode("prompted")}
        >
          With prompts
        </button>
        <button
          type="button"
          className={mode === "free" ? "chip active" : "chip"}
          onClick={() => setMode("free")}
        >
          Free write
        </button>
      </div>

      {mode === "free" ? (
        <label className="field-label">
          What&apos;s here
          <textarea
            className="journal-area"
            value={freeText}
            onChange={(e) => setFreeText(e.target.value)}
            rows={8}
            placeholder="Write freely…"
          />
        </label>
      ) : (
        <div className="prompt-stack">
          <label className="field-label">
            What have been successful today
            <textarea
              className="journal-area"
              value={successes}
              onChange={(e) => setSuccesses(e.target.value)}
              rows={3}
            />
          </label>
          <label className="field-label">
            What you failed today
            <textarea
              className="journal-area"
              value={failures}
              onChange={(e) => setFailures(e.target.value)}
              rows={3}
            />
          </label>
          <label className="field-label">
            What you determined to better tomorrow
            <textarea
              className="journal-area"
              value={intentions}
              onChange={(e) => setIntentions(e.target.value)}
              rows={3}
            />
          </label>
        </div>
      )}

      <div className="action-row">
        <button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
        {saved && <span className="hint">saved</span>}
      </div>
    </section>
  );
}
