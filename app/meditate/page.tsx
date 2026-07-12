/**
 * Meditate page. No data to prefetch — the auth guard lives in AppShell and
 * both sections are client components.
 */

import { FreeMeditation } from "@/components/FreeMeditation";

export default function MeditatePage() {
  return (
    <>
      <header>
        <div className="title">Meditate</div>
        <div className="subtitle">Sit. Let the clock hold the rest.</div>
      </header>

      <div className="page-body">
        <FreeMeditation />

        <section className="panel">
          <h2 className="section-title">Guided meditation</h2>
          <p className="section-lede">
            Spoken sessions with a countdown when you begin one.
          </p>
          <div className="empty-panel">
            <div className="empty-text">Guided sessions coming soon.</div>
          </div>
        </section>
      </div>
    </>
  );
}
