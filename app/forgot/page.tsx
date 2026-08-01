"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export default function ForgotPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.forgot({ email });
      setSent(true);
    } catch (err) {
      // Only rate limiting produces an error here — the endpoint never
      // reveals whether the address exists.
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header>
        <div className="title">mindly</div>
        <div className="subtitle">forgotten, not lost</div>
      </header>

      {sent ? (
        <div className="auth-form">
          <p className="hint">
            If an account exists for {email}, a reset link is on its way.
            Check your inbox — the link works for one hour.
          </p>
          <div className="hint">
            <Link href="/login">back to sign in</Link>
          </div>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit}>
          <label className="field-label">
            email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </label>
          {error && <div className="form-error">{error}</div>}
          <button type="submit" disabled={loading || !email}>
            {loading ? "..." : "Send reset link"}
          </button>
          <div className="hint">
            remembered it? <Link href="/login">sign in</Link>
          </div>
        </form>
      )}
    </>
  );
}
