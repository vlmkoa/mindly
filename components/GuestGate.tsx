"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * Guest handling for features that store personal data. Meditation stays
 * open to everyone; everything that keeps a record (planner, journal,
 * sobriety, the mirror) uses one of these:
 *
 * - <GuestGate>: the classic replacement panel (still used inline).
 * - <GuestPeek>: wraps the REAL feature UI so guests can see what they'd
 *   get (sneak peek). An invisible shield catches the first interaction and
 *   raises the login panel; "keep looking" lowers it again. The content is
 *   `inert`, so keyboard focus can't tunnel underneath either.
 */
export function GuestGate({
  feature,
  hint,
}: {
  feature: string;
  hint?: string;
}) {
  return (
    <div className="guest-gate">
      <div className="guest-gate-title">{feature} needs an account</div>
      <p className="guest-gate-text">
        {hint ??
          "What you keep here is stored privately against your account — so first, you need one."}
      </p>
      <div className="guest-gate-actions">
        <Link href="/signup" className="guest-gate-primary">
          Create account
        </Link>
        <Link href="/login">Log in</Link>
      </div>
    </div>
  );
}

export function GuestPeek({
  feature,
  hint,
  children,
}: {
  feature: string;
  hint?: string;
  children: React.ReactNode;
}) {
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <div className="guest-peek">
      {/* inert: no clicks, no keyboard focus, no form submits underneath */}
      <div className="guest-peek-content" inert>
        {children}
      </div>
      <div
        className={panelOpen ? "guest-peek-shield open" : "guest-peek-shield"}
        onClick={() => setPanelOpen(true)}
      >
        {panelOpen && (
          <div className="guest-peek-panel" onClick={(e) => e.stopPropagation()}>
            <GuestGate feature={feature} hint={hint} />
            <button
              type="button"
              className="guest-peek-dismiss"
              onClick={() => setPanelOpen(false)}
            >
              keep looking
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
