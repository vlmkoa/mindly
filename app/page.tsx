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

export default function HomePage() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  const reload = useCallback(() => {
    api
      .dashboard()
      .then(setData)
      .catch((e) => setError(e?.message ?? "Could not load dashboard."));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <>
      <header>
        <div className="title"> mindly </div>
        <div className="subtitle">Stillness. Reflection. Dissolution.</div>
        {/* Only renders in scene themes; returns null otherwise. */}
        <PixelScene />
        <p className="section-lede home-lede">
          A place to sit, track what you put down, write what the day held, plan
          what remains — and, when certainty hardens, speak to the mirror.
        </p>
      </header>

      <div className="page-body">
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
