"use client";

/**
 * Client-side app shell.
 *
 * Auth is now cookie-based against the FastAPI backend, so the guard lives
 * here in the browser: on protected routes we call /api/auth/me — a 401
 * redirects to /login. Public routes (/login, /signup) skip the check.
 */

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Nav } from "@/components/Nav";
import { api, User } from "@/lib/api";

const PUBLIC_PATHS = ["/login", "/signup"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = PUBLIC_PATHS.includes(pathname);

  // undefined = still checking, null = not logged in, User = logged in
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    if (isPublic) return;
    let cancelled = false;
    api.auth
      .me()
      .then((u) => !cancelled && setUser(u))
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          router.replace("/login");
        }
      });
    return () => {
      cancelled = true;
    };
    // Re-check when navigating between protected pages after login/logout.
  }, [pathname, isPublic, router]);

  return (
    <>
      <div className="grain" />
      <div className="layout layout-wide">
        {isPublic ? (
          children
        ) : user ? (
          <>
            <Nav userName={user.name} />
            {children}
          </>
        ) : (
          // Checking session or redirecting — keep the frame, avoid a flash.
          <div className="empty">
            <div className="empty-text">…</div>
          </div>
        )}
      </div>
    </>
  );
}
