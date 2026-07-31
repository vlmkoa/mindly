"use client";

/**
 * Home dashboard. Fetches everything in one /api/dashboard call and passes
 * a `reload` callback down so mutations (planner checkboxes etc.) refresh
 * the widgets — the client-side equivalent of the old revalidatePath("/").
 */

import { useCallback, useEffect, useState } from "react";
import { api, Dashboard } from "@/lib/api";
import { Planner } from "@/components/Planner";
import { ProgressWidgets } from "@/components/ProgressWidgets";
import { PixelScene } from "@/components/PixelScene";
import { GuestGate } from "@/components/GuestGate";
import { useAuthUser } from "@/components/AppShell";

export default function HomePage() {
  const user = useAuthUser();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e) => setError(e?.message ?? "Could not load dashboard."));
  }, []);

  useEffect(() => {
    if (!user) return; // guests have no dashboard to fetch
    reload();
  }, [reload, user]);

  return (
    <>
      <header>
        <div className="title"> mindly </div>
        <div className="subtitle">Stillness. Reflection. Dissolution.</div>
        {/* Only renders in scene themes; returns null otherwise. */}
        <PixelScene />
        <p className="section-lede home-lede">
          A place to slow down, reflect, and plan for the days ahead. When
          certainty hardens, speak to the mirror.
        </p>
      </header>

      <div className="page-body">
        {user === null && (
          <GuestGate
            feature="Your dashboard"
            hint="Meditation is open to everyone — try it from the tab above. The planner, journal, sobriety timers and the mirror keep personal records, so they live behind an account."
          />
        )}
        {error && <div className="form-error">{error}</div>}
        {data && (
          <div className="home-grid">
            <Planner
              todayTasks={data.todayTasks}
              yesterdayTasks={data.yesterdayTasks}
              onChanged={reload}
            />
            <ProgressWidgets
              meditation={{
                weekMinutes: data.meditationWeekMinutes,
                dayBars: data.meditationDayBars,
              }}
              addictions={data.addictions.map((a) => ({
                id: a.id,
                label: a.label,
                sobrietyStart: a.sobrietyStart,
              }))}
              journal={{ todayDone: data.journalTodayDone, streak: data.journalStreak }}
              koan={{ sessionsThisWeek: data.koanSessionsThisWeek }}
            />
          </div>
        )}
      </div>
    </>
  );
}
