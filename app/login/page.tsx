"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.login({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header>
        <div className="title">________</div>
        <div className="subtitle">return</div>
      </header>

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
        <label className="field-label">
          password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            minLength={8}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={loading || !email || !password}>
          {loading ? "..." : "Sign in"}
        </button>
        <div className="hint">
          no account? <Link href="/signup">create one</Link>
        </div>
      </form>
    </>
  );
}
