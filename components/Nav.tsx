"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/api";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/planner", label: "Planner" },
  { href: "/meditate", label: "Meditate" },
  { href: "/sobriety", label: "Sobriety" },
  { href: "/journal", label: "Journal" },
  { href: "/koan", label: "Koan" },
] as const;

export function Nav({ userName }: { userName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    // Destroys the server-side session + clears the cookie, then bounce.
    await api.auth.logout().catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="app-nav">
      <div className="nav-brand">
        <Link href="/" className="nav-name">
          ________
        </Link>
        {userName && <span className="nav-user">{userName}</span>}
      </div>
      <ul className="nav-links">
        {LINKS.map((l) => {
          const active =
            l.href === "/"
              ? pathname === "/"
              : pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link href={l.href} className={active ? "active" : undefined}>
                {l.label}
              </Link>
            </li>
          );
        })}
      </ul>
      <button type="button" className="nav-signout" onClick={handleSignOut}>
        Sign out
      </button>
    </nav>
  );
}
