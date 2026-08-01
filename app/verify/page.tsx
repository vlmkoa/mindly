"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError } from "@/lib/api";

function VerifyResult() {
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "failed">("working");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setState("failed");
      setError("This page needs the link from your verification email.");
      return;
    }
    api.auth
      .verify({ token })
      .then(() => setState("done"))
      .catch((err) => {
        setState("failed");
        setError(err instanceof ApiError ? err.message : "Something went wrong.");
      });
  }, [token]);

  return (
    <div className="auth-form">
      {state === "working" && <p className="hint">verifying…</p>}
      {state === "done" && (
        <>
          <p className="hint">Email verified — the mirror is open to you now.</p>
          <div className="hint">
            <Link href="/koan">go to the mirror</Link> · <Link href="/">home</Link>
          </div>
        </>
      )}
      {state === "failed" && (
        <>
          <div className="form-error">{error}</div>
          <p className="hint">
            Signed in already? You can request a fresh link from the mirror page.
          </p>
        </>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <>
      <header>
        <div className="title">mindly</div>
        <div className="subtitle">confirmed</div>
      </header>
      <Suspense fallback={null}>
        <VerifyResult />
      </Suspense>
    </>
  );
}
