"use client";

import { useEffect, useState } from "react";

export function CountdownTimer({
  seconds,
  running,
  onComplete,
}: {
  seconds: number;
  running: boolean;
  onComplete?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    setRemaining(seconds);
  }, [seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      onComplete?.();
      return;
    }
    const id = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(id);
  }, [running, remaining, onComplete]);

  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  return (
    <div className="countdown" aria-live="polite">
      {String(m).padStart(2, "0")}:{String(s).padStart(2, "0")}
    </div>
  );
}

export function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
