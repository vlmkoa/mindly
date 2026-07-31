"use client";

/**
 * Client-side app shell.
 *
 * Auth is cookie-based against the FastAPI backend. The shell resolves the
 * session once per navigation and exposes it through useAuthUser():
 *   undefined = still checking · null = guest · User = logged in
 *
 * Guests may browse: meditation is fully usable without an account, and the
 * pages that store personal data (planner, journal, sobriety, the mirror)
 * gate themselves with <GuestGate/> instead of redirecting. Only /login and
 * /signup skip the session check.
 */

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";
import { ThemeProvider } from "@/components/ThemeProvider";
import { MeditationProvider } from "@/components/MeditationProvider";
import { MeditationBar } from "@/components/MeditationBar";
import { ZenScene } from "@/components/ZenScene";
import { api, User } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/signup"];
// Koan reads better in a narrower column; everything else is wide.
// (/journal moved to wide when it became the notebook.)
const READING_PATHS = ["/koan"];

const AuthCtx = createContext<User | null | undefined>(undefined);

/** The resolved session: undefined = checking, null = guest, User = authed. */
export function useAuthUser(): User | null | undefined {
  return useContext(AuthCtx);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const isReading = READING_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  const layoutWidth = isReading ? "layout-reading" : "layout-wide";

  // undefined = still checking, null = guest, User = logged in
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (isPublic) return;
    let cancelled = false;
    api.auth
      .me()
      .then((u) => !cancelled && setUser(u))
      // 401 → guest browsing, not a redirect; pages gate themselves.
      .catch(() => !cancelled && setUser(null));
    return () => {
      cancelled = true;
    };
    // Re-check when navigating so login/logout is picked up.
  }, [pathname, isPublic]);

  return (
    <ThemeProvider>
      <MeditationProvider>
        <AuthCtx.Provider value={user}>
          {/* Full-viewport zen room — renders only in the immersive theme. */}
          <ZenScene />
          <div className="grain" />
          <div className={`layout ${isPublic ? "layout-narrow" : layoutWidth}`}>
            {isPublic ? (
              children
            ) : user !== undefined ? (
              <>
                <Nav userName={user?.name ?? null} />
                {children}
              </>
            ) : (
              // Still resolving the session — keep the frame, avoid a flash.
              <div className="empty">
                <div className="empty-text">…</div>
              </div>
            )}
          </div>
          {/* Persistent player bar — renders only while a session is active. */}
          <MeditationBar />
        </AuthCtx.Provider>
      </MeditationProvider>
    </ThemeProvider>
  );
}
