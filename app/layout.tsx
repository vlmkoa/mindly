import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: "mindly — stillness, reflection, dissolution",
  description:
    "A meditation, sobriety, journal, and planner app — with a koan mirror to unsettle certainty.",
};

// Runs before first paint to set the stored theme, avoiding a color flash.
// It's a rough pass (base light/dark + a few inline vars); ThemeProvider
// refines the day-cycle/custom themes precisely once React mounts.
const THEME_BOOT = `(function(){try{
var t=localStorage.getItem('koan_theme')||'dark';
var el=document.documentElement;
function sys(){return matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';}
if(t==='system'){el.setAttribute('data-theme',sys());return;}
if(t==='daycycle'){var h=new Date().getHours();el.setAttribute('data-theme',(h>=6&&h<18)?'light':'dark');return;}
if(t==='custom'){var c=JSON.parse(localStorage.getItem('koan_theme_custom')||'{}');
var bg=c.bg||'#101418',tx=c.text||'#d8d4c4',ac=c.celestialColor||'#e8b04c';
var n=parseInt(bg.slice(1),16),lum=((n>>16&255)*0.299+(n>>8&255)*0.587+(n&255)*0.114);
el.setAttribute('data-theme',lum>140?'light':'dark');
el.style.setProperty('--bg',bg);el.style.setProperty('--text',tx);el.style.setProperty('--accent',ac);return;}
el.setAttribute('data-theme',t);
}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body suppressHydrationWarning>
        {/* AppShell is a client component: it owns the auth check + nav. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
