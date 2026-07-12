"use client";

/** Preset list + free-text custom input for starting a new tracker. */

import { useState } from "react";
import { ADDICTION_PRESETS } from "@/lib/addictions";
import { api } from "@/lib/api";

export function AddAddictionForm({
  trackedTypes,
  onChanged,
}: {
  trackedTypes: string[];
  onChanged: () => void;
}) {
  const [custom, setCustom] = useState("");
  const [busy, setBusy] = useState(false);
  const available = ADDICTION_PRESETS.filter((p) => !trackedTypes.includes(p.type));

  async function start(type: string, label: string) {
    setBusy(true);
    try {
      await api.sobriety.start(type, label);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel">
      <h2 className="section-title">Start tracking</h2>
      <div className="option-list">
        {available.map((p) => (
          <button
            key={p.type}
            type="button"
            className="option"
            disabled={busy}
            onClick={() => void start(p.type, p.label)}
          >
            <span className="option-label">{p.label}</span>
          </button>
        ))}
      </div>
      <form
        className="inline-form"
        onSubmit={(e) => {
          e.preventDefault();
          const label = custom.trim();
          if (!label) return;
          void start("custom", label).then(() => setCustom(""));
        }}
      >
        <input
          type="text"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          placeholder="Something else…"
        />
        <button type="submit" disabled={busy || !custom.trim()}>
          Add
        </button>
      </form>
    </div>
  );
}
