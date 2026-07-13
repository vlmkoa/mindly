"use client";

/**
 * Theme picker for the nav bar. A compact button opens a popover listing the
 * seven themes; choosing "Custom" reveals color inputs. Everything is driven
 * through the ThemeProvider context, which handles persistence and live updates.
 */

import { useEffect, useRef, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES, ThemeId } from "@/lib/theme";

export function ThemePicker() {
  const { theme, setTheme, custom, setCustomTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const activeLabel = THEMES.find((t) => t.id === theme)?.label ?? "Theme";

  function choose(id: ThemeId) {
    setTheme(id);
    // Keep the popover open for custom so the color inputs are reachable.
    if (id !== "custom") setOpen(false);
  }

  return (
    <div className="theme-picker" ref={ref}>
      <button
        type="button"
        className="nav-signout"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {activeLabel} ▾
      </button>

      {open && (
        <div className="theme-menu" role="menu">
          {THEMES.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.id === theme ? "theme-option active" : "theme-option"}
              onClick={() => choose(t.id)}
              title={t.hint}
            >
              {t.label}
            </button>
          ))}

          {theme === "custom" && (
            <div className="theme-custom-panel">
              <label className="theme-custom-row">
                Celestial
                <select
                  value={custom.celestial}
                  onChange={(e) =>
                    setCustomTheme({
                      ...custom,
                      celestial: e.target.value as "sun" | "moon",
                    })
                  }
                >
                  <option value="sun">Sun</option>
                  <option value="moon">Moon</option>
                </select>
              </label>
              <label className="theme-custom-row">
                Celestial color
                <input
                  type="color"
                  value={custom.celestialColor}
                  onChange={(e) =>
                    setCustomTheme({ ...custom, celestialColor: e.target.value })
                  }
                />
              </label>
              <label className="theme-custom-row">
                Background
                <input
                  type="color"
                  value={custom.bg}
                  onChange={(e) => setCustomTheme({ ...custom, bg: e.target.value })}
                />
              </label>
              <label className="theme-custom-row">
                Text
                <input
                  type="color"
                  value={custom.text}
                  onChange={(e) => setCustomTheme({ ...custom, text: e.target.value })}
                />
              </label>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
