"use client";

/**
 * Sobriety page: live timers per tracked addiction + start/stop/reset.
 * All state is fetched client-side from /api/sobriety/addictions.
 */

import { useCallback, useEffect, useState } from "react";
import { api, AddictionDto } from "@/lib/api";
import { AddictionCard } from "@/components/AddictionCard";
import { AddAddictionForm } from "@/components/AddAddictionForm";
import { GuestPeek } from "@/components/GuestGate";
import { useAuthUser } from "@/components/AppShell";

export default function SobrietyPage() {
  const user = useAuthUser();
  const [addictions, setAddictions] = useState<AddictionDto[] | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api.sobriety
      .list()
      .then(setAddictions)
      .catch((e) => setError(e?.message ?? "Could not load."));
  }, []);

  useEffect(() => {
    if (!user) return; // guests see the gate, not a failed fetch
    reload();
  }, [reload, user]);

  return (
    <>
      <header>
        <div className="title">Sobriety</div>
        <div className="subtitle">What you put down, and how long it stays down.</div>
      </header>

      <div className="page-body">
        {user === null && (
          // Sneak peek: empty state + the add form, behind the shield.
          <GuestPeek feature="Sobriety tracking">
            <div className="empty-panel">
              <div className="empty-text">Nothing tracked yet.</div>
            </div>
            <AddAddictionForm trackedTypes={[]} onChanged={reload} />
          </GuestPeek>
        )}
        {error && <div className="form-error">{error}</div>}

        {addictions && addictions.length === 0 && (
          <div className="empty-panel">
            <div className="empty-text">Nothing tracked yet.</div>
          </div>
        )}

        {addictions && addictions.length > 0 && (
          <div className="card-grid">
            {addictions.map((a) => (
              <AddictionCard key={a.id} addiction={a} onChanged={reload} />
            ))}
          </div>
        )}

        {addictions && (
          <AddAddictionForm
            // Presets already tracked are hidden; "custom" can repeat.
            trackedTypes={addictions.map((a) => a.type).filter((t) => t !== "custom")}
            onChanged={reload}
          />
        )}
      </div>
    </>
  );
}
