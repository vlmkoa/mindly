"use client";

import Link from "next/link";

/**
 * Shown in place of a feature that stores personal data when someone browses
 * without an account. Meditation stays open to everyone; everything that
 * keeps a record (planner, journal, sobriety, the mirror) sits behind this.
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
