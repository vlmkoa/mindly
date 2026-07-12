"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.auth.signup({ email, password, name: name.trim() });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create account.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header>
        <div className="title">________</div>
        <div className="subtitle">begin</div>
      </header>

      <form className="auth-form" onSubmit={onSubmit}>
        <label className="field-label">
          name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="optional"
          />
        </label>
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
            autoComplete="new-password"
            minLength={8}
          />
        </label>
        {error && <div className="form-error">{error}</div>}
        <button type="submit" disabled={loading || !email || password.length < 8}>
          {loading ? "..." : "Create account"}
        </button>
        <div className="hint">
          already have one? <Link href="/login">sign in</Link>
        </div>
      </form>
    </>
  );
}
