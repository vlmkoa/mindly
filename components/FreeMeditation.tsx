"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AudioEngine,
  DEFAULT_SOUND_CONFIG,
  FrequencyToneHandle,
  SoundConfig,
  StopHandle,
  beatBandLabel,
  createAudioEngine,
  playBell,
  previewAmbient,
  startFrequencyTone,
} from "@/lib/audio-engine";
import { AMBIENT_PRESETS, BELL_TYPES, DURATION_OPTIONS } from "@/lib/sound-library";
import { api } from "@/lib/api";
import { CountdownTimer } from "@/components/CountdownTimer";
import {
  IconBell,
  IconBinaural,
  IconDrone,
  IconEnso,
  IconSine,
  IconSliders,
  IconWaves,
  IconWind,
  IconWood,
} from "@/components/icons";

type Preset = "silence" | "ambient" | "bells" | "tailor";

const MIN_SEC = 60; // 1 minute
const MAX_SEC = 8 * 3600; // 8 hours
const STEP_SEC = 5 * 60;

/** Sub-hour shows minutes; past an hour it reads "1 h 30 min". */
function durationLabel(sec: number): string {
  const totalMin = Math.round(sec / 60);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const AMBIENT_ICONS: Record<string, React.ReactNode> = {
  "deep-drone": <IconDrone />,
  wind: <IconWind />,
  "still-water": <IconWaves />,
};

const BELL_ICONS: Record<string, React.ReactNode> = {
  small: <IconBell size={13} />,
  large: <IconBell size={16} />,
  wood: <IconWood />,
};

// Common binaural targets. Theta/alpha are the bands meditation research
// usually aims for; the rest are included for completeness.
const BINAURAL_RECS = [
  { delta: 2, label: "Delta 2 Hz", desc: "deep sleep" },
  { delta: 6, label: "Theta 6 Hz", desc: "deep meditation" },
  { delta: 10, label: "Alpha 10 Hz", desc: "calm focus" },
  { delta: 18, label: "Beta 18 Hz", desc: "alertness" },
  { delta: 40, label: "Gamma 40 Hz", desc: "experimental" },
];

// Carrier-frequency range for the mono/binaural tones (Hz). The number boxes
// and the sliders share these bounds.
const FREQ_MIN = 40;
const FREQ_MAX = 1000;

/**
 * A number input for a carrier frequency, paired with a slider. Keeps its own
 * draft string so the field can be cleared and retyped without fighting the
 * controlled value; commits (clamped to [min,max]) on blur/Enter, and applies
 * live only while the typed value is already in range — so a half-typed "4" on
 * the way to "432" doesn't blip the tone down to 4 Hz.
 */
function FreqNumberBox({
  value,
  min,
  max,
  onCommit,
  ariaLabel,
}: {
  value: number;
  min: number;
  max: number;
  onCommit: (hz: number) => void;
  ariaLabel: string;
}) {
  const [draft, setDraft] = useState(String(value));
  const [focused, setFocused] = useState(false);

  // Follow external changes (slider drags, preset buttons) while not editing.
  useEffect(() => {
    if (!focused) setDraft(String(value));
  }, [value, focused]);

  function commit() {
    const n = Math.round(Number(draft));
    const next = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value;
    setDraft(String(next));
    onCommit(next);
  }

  return (
    <input
      className="freq-number"
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={draft}
      aria-label={ariaLabel}
      onFocus={() => setFocused(true)}
      onChange={(e) => {
        const raw = e.target.value;
        setDraft(raw);
        const n = Number(raw);
        if (Number.isFinite(n) && n >= min && n <= max) onCommit(Math.round(n));
      }}
      onBlur={() => {
        setFocused(false);
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

export function FreeMeditation() {
  const [durationSec, setDurationSec] = useState(10 * 60);
  const [editingDuration, setEditingDuration] = useState(false);
  const [draftMin, setDraftMin] = useState("10");
  const [config, setConfig] = useState<SoundConfig>(DEFAULT_SOUND_CONFIG);
  const [preset, setPreset] = useState<Preset>("silence");
  const [freqPreviewOn, setFreqPreviewOn] = useState(false);
  const [running, setRunning] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [doneMsg, setDoneMsg] = useState("");
  const engineRef = useRef<AudioEngine | null>(null);
  const completedRef = useRef(false);
  // At most one ambient preview + one frequency preview live at a time.
  const ambientPreviewRef = useRef<StopHandle | null>(null);
  const freqPreviewRef = useRef<FrequencyToneHandle | null>(null);

  const stopPreviews = useCallback(() => {
    ambientPreviewRef.current?.();
    ambientPreviewRef.current = null;
    freqPreviewRef.current?.stop();
    freqPreviewRef.current = null;
    setFreqPreviewOn(false);
  }, []);

  useEffect(() => {
    return () => {
      ambientPreviewRef.current?.();
      freqPreviewRef.current?.stop();
      engineRef.current?.stop();
      void engineRef.current?.ctx.close();
    };
  }, []);

  function ensureEngine() {
    if (!engineRef.current) {
      engineRef.current = createAudioEngine();
    }
    return engineRef.current;
  }

  // ─── Duration stepper ──────────────────────────────────────────────────────

  function nudgeDuration(deltaSec: number) {
    setDurationSec((s) => Math.min(MAX_SEC, Math.max(MIN_SEC, s + deltaSec)));
  }

  function commitDraftDuration() {
    const min = Math.round(Number(draftMin));
    if (Number.isFinite(min) && min > 0) {
      setDurationSec(Math.min(MAX_SEC, Math.max(MIN_SEC, min * 60)));
    }
    setEditingDuration(false);
  }

  function beginEditDuration() {
    if (running) return;
    setDraftMin(String(Math.round(durationSec / 60)));
    setEditingDuration(true);
  }

  // ─── Presets & previews ────────────────────────────────────────────────────

  function playAmbientPreview(presetId: string) {
    const engine = ensureEngine();
    ambientPreviewRef.current?.();
    ambientPreviewRef.current = previewAmbient(engine.ctx, presetId);
  }

  function applyPreset(p: Exclude<Preset, "tailor">) {
    setPreset(p);
    stopPreviews();
    if (p === "silence") {
      setConfig({ ...DEFAULT_SOUND_CONFIG });
    } else if (p === "ambient") {
      setConfig({
        ...DEFAULT_SOUND_CONFIG,
        music: { enabled: true, presetId: "deep-drone" },
      });
      playAmbientPreview("deep-drone");
    } else {
      setConfig({
        ...DEFAULT_SOUND_CONFIG,
        bells: {
          enabled: true,
          type: "small",
          intervalMin: 5,
          strikeStart: true,
          strikeEnd: true,
        },
      });
      playBell(ensureEngine().ctx, "small");
    }
  }

  function chooseAmbient(presetId: string) {
    setConfig((c) => ({ ...c, music: { enabled: true, presetId } }));
    playAmbientPreview(presetId);
  }

  function chooseBell(type: SoundConfig["bells"]["type"]) {
    setConfig((c) => ({ ...c, bells: { ...c.bells, type } }));
    playBell(ensureEngine().ctx, type);
  }

  // ─── Frequencies (live preview follows every change) ───────────────────────

  function setFrequencies(patch: Partial<SoundConfig["frequencies"]>) {
    setConfig((c) => {
      const next = { ...c.frequencies, ...patch };
      freqPreviewRef.current?.update(next);
      return { ...c, frequencies: next };
    });
  }

  function toggleFreqPreview() {
    if (freqPreviewRef.current) {
      freqPreviewRef.current.stop();
      freqPreviewRef.current = null;
      setFreqPreviewOn(false);
    } else {
      freqPreviewRef.current = startFrequencyTone(ensureEngine().ctx, config.frequencies);
      setFreqPreviewOn(true);
    }
  }

  function applyBinauralRec(delta: number) {
    setFrequencies({ mode: "binaural", leftHz: 200, rightHz: 200 + delta });
  }

  // ─── Session lifecycle ─────────────────────────────────────────────────────

  const finish = useCallback(async () => {
    if (completedRef.current) return;
    completedRef.current = true;
    const engine = engineRef.current;
    if (engine && config.bells.enabled && config.bells.strikeEnd) {
      engine.strikeBell();
    }
    engine?.stop();
    setRunning(false);
    setSaving(true);
    try {
      // Persist the completed session (audio itself never leaves the browser).
      await api.meditation.save({
        kind: "free",
        durationSec,
        soundConfig: JSON.stringify(config),
      });
      setDoneMsg("Session recorded.");
    } catch {
      setDoneMsg("Could not save session.");
    } finally {
      setSaving(false);
    }
  }, [config, durationSec]);

  function start() {
    completedRef.current = false;
    setDoneMsg("");
    stopPreviews();
    const engine = ensureEngine();
    engine.start(config);
    setSessionKey((k) => k + 1);
    setRunning(true);
  }

  function stopEarly() {
    engineRef.current?.stop();
    setRunning(false);
    completedRef.current = true;
  }

  const delta = Math.abs(config.frequencies.rightHz - config.frequencies.leftHz);

  return (
    <section className="panel">
      <h2 className="section-title">Free meditation</h2>
      <p className="section-lede">
        A timer, and whatever sound you need — or none.
      </p>

      <div className="duration-row">
        {DURATION_OPTIONS.map((d) => (
          <button
            key={d.sec}
            type="button"
            className={durationSec === d.sec ? "chip active" : "chip"}
            disabled={running}
            onClick={() => setDurationSec(d.sec)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="stepper-row">
        <button
          type="button"
          className="stepper-btn"
          disabled={running || durationSec <= MIN_SEC}
          onClick={() => nudgeDuration(-STEP_SEC)}
          aria-label="5 minutes less"
        >
          −
        </button>
        {editingDuration ? (
          <input
            className="stepper-input"
            type="number"
            min={1}
            max={MAX_SEC / 60}
            value={draftMin}
            autoFocus
            onChange={(e) => setDraftMin(e.target.value)}
            onBlur={commitDraftDuration}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitDraftDuration();
              if (e.key === "Escape") setEditingDuration(false);
            }}
          />
        ) : (
          <button
            type="button"
            className="stepper-value"
            disabled={running}
            onClick={beginEditDuration}
            title="Click to type minutes"
          >
            {durationLabel(durationSec)}
          </button>
        )}
        <button
          type="button"
          className="stepper-btn"
          disabled={running || durationSec >= MAX_SEC}
          onClick={() => nudgeDuration(STEP_SEC)}
          aria-label="5 minutes more"
        >
          +
        </button>
        <span className="hint">5-min steps — click the time to type it</span>
      </div>

      <CountdownTimer
        key={sessionKey}
        seconds={durationSec}
        running={running}
        onComplete={finish}
      />

      {!running && (
        <>
          <div className="subsection-label">Quick presets</div>
          <div className="duration-row">
            <button
              type="button"
              className={preset === "silence" ? "chip active" : "chip"}
              onClick={() => applyPreset("silence")}
            >
              <IconEnso />
              Silence
            </button>
            <button
              type="button"
              className={preset === "ambient" ? "chip active" : "chip"}
              onClick={() => applyPreset("ambient")}
            >
              <IconWaves />
              Ambient bed
            </button>
            <button
              type="button"
              className={preset === "bells" ? "chip active" : "chip"}
              onClick={() => applyPreset("bells")}
            >
              <IconBell />
              Bells only
            </button>
            <button
              type="button"
              className={preset === "tailor" ? "chip active" : "chip"}
              onClick={() => setPreset("tailor")}
            >
              <IconSliders />
              Tailor your own
            </button>
          </div>

          {preset === "tailor" && (
            <div className="sound-builder">
              {/* Music */}
              <div className="builder-block">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={config.music.enabled}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        music: {
                          enabled: e.target.checked,
                          presetId: c.music.presetId ?? "deep-drone",
                        },
                      }))
                    }
                  />
                  <span>Background music</span>
                </label>
                {config.music.enabled && (
                  <div className="option-list">
                    {AMBIENT_PRESETS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className={
                          config.music.presetId === p.id ? "option active" : "option"
                        }
                        onClick={() => chooseAmbient(p.id)}
                      >
                        <span className="option-label">
                          <span className="option-icon">{AMBIENT_ICONS[p.id]}</span>
                          {p.label}
                        </span>
                        <span className="option-desc">{p.description}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Bells */}
              <div className="builder-block">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={config.bells.enabled}
                    onChange={(e) =>
                      setConfig((c) => ({
                        ...c,
                        bells: { ...c.bells, enabled: e.target.checked },
                      }))
                    }
                  />
                  <span>Bell sounds</span>
                </label>
                {config.bells.enabled && (
                  <div className="builder-fields">
                    <div className="duration-row">
                      {BELL_TYPES.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          className={config.bells.type === b.id ? "chip active" : "chip"}
                          title={b.description}
                          onClick={() => chooseBell(b.id)}
                        >
                          {BELL_ICONS[b.id]}
                          {b.label}
                        </button>
                      ))}
                    </div>
                    <label className="field-label">
                      Interval (minutes) — 0 = start/end only
                      <input
                        type="range"
                        min={0}
                        max={10}
                        step={1}
                        value={config.bells.intervalMin}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            bells: {
                              ...c.bells,
                              intervalMin: Number(e.target.value),
                            },
                          }))
                        }
                      />
                      <span className="slider-value">
                        {config.bells.intervalMin === 0
                          ? "start / end only"
                          : `every ${config.bells.intervalMin} min`}
                      </span>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={config.bells.strikeStart}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            bells: { ...c.bells, strikeStart: e.target.checked },
                          }))
                        }
                      />
                      <span>Strike at start</span>
                    </label>
                    <label className="toggle-row">
                      <input
                        type="checkbox"
                        checked={config.bells.strikeEnd}
                        onChange={(e) =>
                          setConfig((c) => ({
                            ...c,
                            bells: { ...c.bells, strikeEnd: e.target.checked },
                          }))
                        }
                      />
                      <span>Strike at end</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Frequencies */}
              <div className="builder-block">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={config.frequencies.enabled}
                    onChange={(e) => {
                      // Turning the block off also silences a running preview.
                      if (!e.target.checked && freqPreviewRef.current) {
                        freqPreviewRef.current.stop();
                        freqPreviewRef.current = null;
                        setFreqPreviewOn(false);
                      }
                      setConfig((c) => ({
                        ...c,
                        frequencies: {
                          ...c.frequencies,
                          enabled: e.target.checked,
                        },
                      }));
                    }}
                  />
                  <span>Frequencies</span>
                </label>
                {config.frequencies.enabled && (
                  <div className="builder-fields">
                    <div className="duration-row">
                      <button
                        type="button"
                        className={
                          config.frequencies.mode === "mono" ? "chip active" : "chip"
                        }
                        onClick={() => setFrequencies({ mode: "mono" })}
                      >
                        <IconSine />
                        Mono beat
                      </button>
                      <button
                        type="button"
                        className={
                          config.frequencies.mode === "binaural"
                            ? "chip active"
                            : "chip"
                        }
                        onClick={() => setFrequencies({ mode: "binaural" })}
                      >
                        <IconBinaural />
                        Binaural
                      </button>
                      <button
                        type="button"
                        className={freqPreviewOn ? "chip active" : "chip"}
                        onClick={toggleFreqPreview}
                      >
                        {freqPreviewOn ? "◼ Stop preview" : "▶ Preview"}
                      </button>
                    </div>

                    {config.frequencies.mode === "mono" ? (
                      <label className="field-label">
                        <span className="field-row">
                          <span>Frequency</span>
                          <span className="field-row-input">
                            <FreqNumberBox
                              value={config.frequencies.monoHz}
                              min={FREQ_MIN}
                              max={FREQ_MAX}
                              onCommit={(hz) => setFrequencies({ monoHz: hz })}
                              ariaLabel="Mono frequency in hertz"
                            />
                            Hz
                          </span>
                        </span>
                        <input
                          type="range"
                          min={FREQ_MIN}
                          max={FREQ_MAX}
                          step={1}
                          value={config.frequencies.monoHz}
                          onChange={(e) =>
                            setFrequencies({ monoHz: Number(e.target.value) })
                          }
                        />
                      </label>
                    ) : (
                      <>
                        <div className="duration-row rec-row">
                          {BINAURAL_RECS.map((r) => (
                            <button
                              key={r.delta}
                              type="button"
                              className={
                                Math.abs(delta - r.delta) < 0.01
                                  ? "chip active"
                                  : "chip"
                              }
                              onClick={() => applyBinauralRec(r.delta)}
                            >
                              {r.label}
                              <span className="chip-sub">{r.desc}</span>
                            </button>
                          ))}
                        </div>
                        <div className="hint">
                          theta and alpha are the bands most used for meditation —
                          effects are subtle, headphones required
                        </div>
                        <label className="field-label">
                          <span className="field-row">
                            <span>Left ear</span>
                            <span className="field-row-input">
                              <FreqNumberBox
                                value={config.frequencies.leftHz}
                                min={FREQ_MIN}
                                max={FREQ_MAX}
                                onCommit={(hz) => setFrequencies({ leftHz: hz })}
                                ariaLabel="Left ear frequency in hertz"
                              />
                              Hz
                            </span>
                          </span>
                          <input
                            type="range"
                            min={FREQ_MIN}
                            max={FREQ_MAX}
                            step={1}
                            value={config.frequencies.leftHz}
                            onChange={(e) =>
                              setFrequencies({ leftHz: Number(e.target.value) })
                            }
                          />
                        </label>
                        <label className="field-label">
                          <span className="field-row">
                            <span>Right ear</span>
                            <span className="field-row-input">
                              <FreqNumberBox
                                value={config.frequencies.rightHz}
                                min={FREQ_MIN}
                                max={FREQ_MAX}
                                onCommit={(hz) => setFrequencies({ rightHz: hz })}
                                ariaLabel="Right ear frequency in hertz"
                              />
                              Hz
                            </span>
                          </span>
                          <input
                            type="range"
                            min={FREQ_MIN}
                            max={FREQ_MAX}
                            step={1}
                            value={config.frequencies.rightHz}
                            onChange={(e) =>
                              setFrequencies({ rightHz: Number(e.target.value) })
                            }
                          />
                        </label>
                        <div className="delta-display">
                          Δ {delta.toFixed(1)} Hz — {beatBandLabel(delta)}
                          <span className="hint"> headphones recommended</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      <div className="action-row">
        {!running ? (
          <button type="button" onClick={start}>
            Begin
          </button>
        ) : (
          <button type="button" onClick={stopEarly}>
            End early
          </button>
        )}
        {saving && <span className="hint">saving…</span>}
        {doneMsg && <span className="hint">{doneMsg}</span>}
      </div>
    </section>
  );
}
