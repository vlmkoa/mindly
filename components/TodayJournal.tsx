"use client";

/**
 * Today's journal editor — free write or prompts, both built from blocks.
 *
 * A block is an optional heading + a textarea. Prompted mode starts from the
 * three default prompts; free mode starts from one unlabeled block. Either way
 * the user can retitle, add (up to 20, the server cap), and remove blocks.
 * Each mode keeps its own draft while toggling; only Save persists.
 */

import { useState } from "react";
import { api, JournalBlock, JournalEntryDto } from "@/lib/api";

type Mode = "free" | "prompted";

const MAX_BLOCKS = 20; // mirrors the server-side cap
const DEFAULT_PROMPTS = [
  "What went well today",
  "Where you fell short today",
  "What you'll do better tomorrow",
];

/** Initial blocks for a mode: saved blocks → legacy fields → defaults. */
function hydrate(mode: Mode, initial: JournalEntryDto | null): JournalBlock[] {
  if (initial?.mode === mode && initial.blocks?.length) {
    return initial.blocks.map((b) => ({ ...b }));
  }
  if (initial?.mode === mode) {
    // Legacy entry (pre-blocks): map the fixed fields into blocks.
    if (mode === "free" && initial.freeText != null) {
      return [{ label: "", text: initial.freeText }];
    }
    if (
      mode === "prompted" &&
      (initial.successes != null || initial.failures != null || initial.intentions != null)
    ) {
      return [
        { label: DEFAULT_PROMPTS[0], text: initial.successes ?? "" },
        { label: DEFAULT_PROMPTS[1], text: initial.failures ?? "" },
        { label: DEFAULT_PROMPTS[2], text: initial.intentions ?? "" },
      ];
    }
  }
  return mode === "prompted"
    ? DEFAULT_PROMPTS.map((label) => ({ label, text: "" }))
    : [{ label: "", text: "" }];
}

export function TodayJournal({
  initial,
  onSaved,
}: {
  initial: JournalEntryDto | null;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>(initial?.mode ?? "prompted");
  // Separate drafts per mode so toggling doesn't destroy typed text.
  const [freeBlocks, setFreeBlocks] = useState<JournalBlock[]>(() => hydrate("free", initial));
  const [promptedBlocks, setPromptedBlocks] = useState<JournalBlock[]>(() =>
    hydrate("prompted", initial)
  );
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const blocks = mode === "free" ? freeBlocks : promptedBlocks;
  const setBlocks = mode === "free" ? setFreeBlocks : setPromptedBlocks;

  function updateBlock(i: number, patch: Partial<JournalBlock>) {
    setBlocks((list) => list.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function removeBlock(i: number) {
    setBlocks((list) => list.filter((_, j) => j !== i));
  }

  function addBlock() {
    setBlocks((list) =>
      list.length >= MAX_BLOCKS ? list : [...list, { label: "", text: "" }]
    );
  }

  async function save() {
    setBusy(true);
    try {
      await api.journal.upsert({
        mode,
        // Blocks where nothing was written don't need to be stored.
        blocks: blocks.filter((b) => b.label.trim() || b.text.trim()),
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

      <div className="prompt-stack">
        {blocks.map((b, i) => (
          <div key={i} className="journal-block">
            <div className="block-head">
              <input
                className="block-label-input"
                value={b.label}
                maxLength={200}
                placeholder={mode === "prompted" ? "Prompt…" : "Heading (optional)…"}
                aria-label="Block heading"
                onChange={(e) => updateBlock(i, { label: e.target.value })}
              />
              {blocks.length > 1 && (
                <button
                  type="button"
                  className="ghost-btn"
                  aria-label="Remove block"
                  onClick={() => removeBlock(i)}
                >
                  ×
                </button>
              )}
            </div>
            <textarea
              className="journal-area"
              value={b.text}
              rows={mode === "free" ? 6 : 3}
              placeholder={mode === "free" ? "Write freely…" : ""}
              onChange={(e) => updateBlock(i, { text: e.target.value })}
            />
          </div>
        ))}
        <div>
          <button type="button" onClick={addBlock} disabled={blocks.length >= MAX_BLOCKS}>
            + Add block
          </button>
        </div>
      </div>

      <div className="action-row">
        <button type="button" onClick={() => void save()} disabled={busy}>
          {busy ? "…" : "Save"}
        </button>
        {saved && <span className="hint">saved</span>}
      </div>
    </section>
  );
}
