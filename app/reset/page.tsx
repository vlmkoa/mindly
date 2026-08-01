"use client";

import { FormEvent, Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

function ResetForm() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await api.auth.reset({ token, password });
      // Reset revokes all sessions — send them to sign in with the new one.
      router.push("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-form">
        <p className="hint">
          This page needs the link from your reset email. If yours expired,{" "}
          <Link href="/forgot">request a new one</Link>.
        </p>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <label className="field-label">
        new password
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
      </label>
      <label className="field-label">
        confirm password
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          autoComplete="new-password"
          minLength={8}
        />
      </label>
      {error && <div className="form-error">{error}</div>}
      <button type="submit" disabled={loading || !password || !confirm}>
        {loading ? "..." : "Set new password"}
      </button>
      <div className="hint">
        link expired? <Link href="/forgot">request another</Link>
      </div>
    </form>
  );
}

export default function ResetPage() {
  return (
    <>
      <header>
        <div className="title">mindly</div>
        <div className="subtitle">begin again</div>
      </header>
      {/* useSearchParams requires a Suspense boundary in the App Router. */}
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </>
  );
}
