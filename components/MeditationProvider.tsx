"use client";

/**
 * Global meditation session.
 *
 * The audio engine and the countdown live here, mounted high in AppShell — above
 * the routed page — so a session keeps playing and counting down as the user
 * moves between tabs. The /meditate page starts a session and the persistent
 * MeditationBar controls it from anywhere.
 *
 * The timer is timestamp-based (`endsAt`) rather than a decrementing counter, so
 * it stays accurate across re-renders and tab switches.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { AudioEngine, SoundConfig, createAudioEngine } from "@/lib/audio-engine";
import { api } from "@/lib/api";

export type MeditationSession = {
  totalSec: number;
  remainingSec: number;
  paused: boolean;
  label: string; // short descriptor of the sound, for the bar
};

type MeditationCtx = {
  session: MeditationSession | null;
  notice: string; // set after a completed session ("Session recorded." / error)
  start: (config: SoundConfig, durationSec: number) => void;
  pause: () => void;
  resume: () => void;
  end: () => void; // manual stop before completion — not saved
};

const Ctx = createContext<MeditationCtx | null>(null);

export function useMeditation(): MeditationCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useMeditation must be used inside MeditationProvider");
  return ctx;
}

/** A short human label for the bar, e.g. "still water · bells". */
function describe(config: SoundConfig): string {
  const parts: string[] = [];
  if (config.music.enabled && config.music.presetId)
    parts.push(config.music.presetId.replace(/-/g, " "));
  if (config.bells.enabled) parts.push("bells");
  if (config.frequencies.enabled)
    parts.push(config.frequencies.mode === "binaural" ? "binaural" : "tone");
  return parts.length ? parts.join(" · ") : "silence";
}

export function MeditationProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<MeditationSession | null>(null);
  const [notice, setNotice] = useState("");

  const engineRef = useRef<AudioEngine | null>(null);
  const configRef = useRef<SoundConfig | null>(null);
  const totalRef = useRef(0);
  const endsAtRef = useRef(0); // epoch ms the timer reaches 0 (while running)
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<MeditationSession | null>(null);

  // Mirror session into a ref so the imperative controls read the latest value
  // without being re-created on every tick.
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Natural completion: end bell, stop, and persist the session.
  const complete = useCallback(async () => {
    clearTick();
    const engine = engineRef.current;
    const config = configRef.current;
    if (engine && config?.bells.enabled && config.bells.strikeEnd) engine.strikeBell();
    engine?.stop();
    setSession(null);
    try {
      await api.meditation.save({
        kind: "free",
        durationSec: totalRef.current,
        soundConfig: JSON.stringify(config),
      });
      setNotice("Session recorded.");
    } catch {
      setNotice("Could not save session.");
    }
  }, [clearTick]);

  const startTick = useCallback(() => {
    clearTick();
    tickRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setSession((s) => (s && !s.paused ? { ...s, remainingSec: remaining } : s));
      if (remaining <= 0) void complete();
    }, 250);
  }, [clearTick, complete]);

  const start = useCallback(
    (config: SoundConfig, durationSec: number) => {
      if (!engineRef.current) engineRef.current = createAudioEngine();
      engineRef.current.start(config);
      configRef.current = config;
      totalRef.current = durationSec;
      endsAtRef.current = Date.now() + durationSec * 1000;
      setNotice("");
      setSession({
        totalSec: durationSec,
        remainingSec: durationSec,
        paused: false,
        label: describe(config),
      });
      startTick();
    },
    [startTick]
  );

  const pause = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.paused) return;
    engineRef.current?.pause();
    clearTick();
    setSession({ ...s, paused: true });
  }, [clearTick]);

  const resume = useCallback(() => {
    const s = sessionRef.current;
    if (!s || !s.paused) return;
    engineRef.current?.resume();
    endsAtRef.current = Date.now() + s.remainingSec * 1000;
    setSession({ ...s, paused: false });
    startTick();
  }, [startTick]);

  const end = useCallback(() => {
    clearTick();
    engineRef.current?.stop();
    setSession(null);
  }, [clearTick]);

  // Close the audio context when the app itself unmounts.
  useEffect(() => {
    return () => {
      clearTick();
      engineRef.current?.stop();
      void engineRef.current?.ctx.close();
    };
  }, [clearTick]);

  return (
    <Ctx.Provider value={{ session, notice, start, pause, resume, end }}>
      {children}
    </Ctx.Provider>
  );
}
