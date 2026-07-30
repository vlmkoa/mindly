"use client";

/**
 * The journal as an open pixel-art book — a two-page spread drawn on a
 * 208×150 pixel grid (SVG rects with crispEdges, the PixelScene idiom):
 * leather cover with stepped corners, page-block stack edges, a stitched
 * spine well, and a bookmark ribbon. HTML content is overlaid on the two
 * page areas through shared grid constants, so it aligns at any width.
 *
 * Left page: one day (today embeds TodayJournal, earlier days render
 * read-only). Right page: the month calendar (the book's index), streak and
 * page count. Pages exist only for days that have entries, so there are no
 * blank stretches to leaf through.
 *
 * The page turn is deliberately flat 2D, like a sprite animation: a paper
 * leaf folds to the spine and lands on the far page in discrete steps()
 * frames — no perspective, no easing. Content swaps when the leaf lands.
 * Navigation: fold-corner buttons, ← / → keys (ignored while typing), or
 * the calendar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Pixelify_Sans } from "next/font/google";
import { JournalEntryDto, localToday } from "@/lib/api";
import { monthLabel } from "@/lib/dates";
import { buildMonthCells } from "@/components/MonthPlanner";
import { TodayJournal } from "@/components/TodayJournal";

// Game-font for the notebook chrome (headers, calendar, buttons). Entry text
// stays in the app serif for readability. Exposed to CSS as --nb-pixel.
const pixelFont = Pixelify_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--nb-pixel",
});

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"]; // Mon-start, matches the planner

const TURN_MS = 160; // per flip phase; keep in sync with the nb-leaf animations

type Turning = { dir: 1 | -1; phase: "out" | "in" } | null;

/* ── Pixel-art grid ──────────────────────────────────────────────────────────
   All art coordinates live on this grid; the page overlays derive their
   percentage positions from the same constants, so drawing and content can
   never drift apart. One grid cell ≈ 5px at full width. */

const GW = 208;
const GH = 160; // fat-journal ratio (~1.3:1) — the default editor must fit a page
const COVER = { w: 204, h: 154 }; // at (0,0); desk shadow offsets +4,+5
const PAGE = { y: 7, w: 90, h: 138 };
const LP_X = 10; // left page x; spine well spans 100..103
const RP_X = 104;
const CORNER = [4, 2, 1]; // per-row inset of the stepped cover corners

type Rect = { x: number; y: number; w: number; h: number };
type Layer = { fill: string; rects: Rect[] };

/** Rectangle with stepped (pixel-rounded) corners: N stepped rows top and
 *  bottom (row i inset by steps[i] from each side), one body rect between. */
function slab(x: number, y: number, w: number, h: number, steps: number[]): Rect[] {
  const out: Rect[] = [];
  steps.forEach((ins, i) => {
    out.push({ x: x + ins, y: y + i, w: w - ins * 2, h: 1 });
    out.push({ x: x + ins, y: y + h - 1 - i, w: w - ins * 2, h: 1 });
  });
  out.push({ x, y: y + steps.length, w, h: h - steps.length * 2 });
  return out;
}

function cells(list: [number, number][]): Rect[] {
  return list.map(([x, y]) => ({ x, y, w: 1, h: 1 }));
}

function buildArt(): Layer[] {
  const layers: Layer[] = [];

  // Desk shadow — hard offset, no blur (pixel light).
  layers.push({ fill: "rgba(26, 17, 8, 0.35)", rects: slab(4, 5, COVER.w, COVER.h, CORNER) });

  // Cover: dark outline slab with the leather slab inset one cell.
  layers.push({ fill: "#2c1a0d", rects: slab(0, 0, COVER.w, COVER.h, CORNER) });
  layers.push({ fill: "#6b4a32", rects: slab(1, 1, COVER.w - 2, COVER.h - 2, [3, 2, 1]) });

  // Bevel: light catches top/left, shade pools bottom/right.
  layers.push({
    fill: "#8a6544",
    rects: [
      { x: 4, y: 2, w: COVER.w - 8, h: 1 },
      { x: 2, y: 4, w: 1, h: COVER.h - 8 },
    ],
  });
  layers.push({
    fill: "#4a3320",
    rects: [
      { x: 4, y: COVER.h - 3, w: COVER.w - 8, h: 1 },
      { x: COVER.w - 3, y: 4, w: 1, h: COVER.h - 8 },
    ],
  });

  // Worn-leather dither on the visible frame — sparse, or it reads as dirt.
  layers.push({
    fill: "#7d5639",
    rects: cells([
      [14, 4], [96, 5], [183, 3], [5, 30], [199, 52], [6, 58],
      [41, 149], [122, 148], [88, 147],
    ]),
  });
  layers.push({
    fill: "#57381f",
    rects: cells([
      [33, 5], [121, 3], [192, 4], [3, 49], [200, 29], [199, 74], [5, 96],
      [23, 147], [104, 149], [151, 147],
    ]),
  });

  // Closed page block: stepped stack edges peeking out under each page —
  // this is what makes the book read as thick.
  const stackTones = ["#ead9b6", "#d9c5a0", "#c3ac82"];
  stackTones.forEach((fill, i) => {
    const k = i + 1;
    layers.push({
      fill,
      rects: [
        { x: LP_X - k, y: PAGE.y + k, w: 1, h: PAGE.h },
        { x: LP_X - k, y: PAGE.y + PAGE.h - 1 + k, w: PAGE.w + k, h: 1 },
        { x: RP_X + PAGE.w - 1 + k, y: PAGE.y + k, w: 1, h: PAGE.h },
        { x: RP_X, y: PAGE.y + PAGE.h - 1 + k, w: PAGE.w + k, h: 1 },
      ],
    });
  });

  // Spine well between the pages, with cream stitching (small, or it
  // dominates the whole spread).
  const stitches: Rect[] = [];
  for (let y = PAGE.y + 6; y <= PAGE.y + PAGE.h - 8; y += 8) {
    stitches.push({ x: 101, y, w: 2, h: 2 });
  }
  layers.push({ fill: "#3a2718", rects: [{ x: 100, y: PAGE.y, w: 4, h: PAGE.h }] });
  layers.push({ fill: "#d8c8a4", rects: stitches });

  // The two open pages.
  layers.push({
    fill: "#f2e8d0",
    rects: [
      { x: LP_X, y: PAGE.y, w: PAGE.w, h: PAGE.h },
      { x: RP_X, y: PAGE.y, w: PAGE.w, h: PAGE.h },
    ],
  });

  // Gutter shading: paper curving down into the spine (3 tones each side).
  const gutter: [string, number][] = [
    ["#ecdfc1", 3],
    ["#e3d4b2", 2],
    ["#d5c49e", 1],
  ];
  gutter.forEach(([fill, d]) => {
    layers.push({
      fill,
      rects: [
        { x: LP_X + PAGE.w - d, y: PAGE.y, w: 1, h: PAGE.h },
        { x: RP_X + d - 1, y: PAGE.y, w: 1, h: PAGE.h },
      ],
    });
  });

  // Bottom paper edge.
  layers.push({
    fill: "#e3d5b4",
    rects: [
      { x: LP_X, y: PAGE.y + PAGE.h - 1, w: PAGE.w, h: 1 },
      { x: RP_X, y: PAGE.y + PAGE.h - 1, w: PAGE.w, h: 1 },
    ],
  });

  // Red margin line on the writing page only (no ruled lines — they fought
  // the text; the calendar page stays clean).
  layers.push({
    fill: "#dbb3a6",
    rects: [{ x: LP_X + 7, y: PAGE.y, w: 1, h: PAGE.h - 1 }],
  });

  // A few freckles of age on the paper.
  layers.push({
    fill: "#e9dcbe",
    rects: cells([
      [24, 18], [71, 15], [33, 52], [62, 66], [19, 84], [55, 101],
      [118, 20], [165, 16], [127, 57], [156, 70], [113, 88], [149, 111],
    ]),
  });

  // Printed motif on the calendar page's lower half — a faint pixel
  // landscape echoing PixelScene (hills, sun, ground line). Stationery-faint
  // so it never competes with text.
  layers.push({
    fill: "#e9d6a4",
    rects: [
      { x: 157, y: 112, w: 2, h: 1 },
      { x: 156, y: 113, w: 4, h: 2 },
      { x: 157, y: 115, w: 2, h: 1 },
    ],
  });
  layers.push({
    fill: "#e3d6b6",
    rects: [
      { x: 138, y: 120, w: 5, h: 1 },
      { x: 136, y: 121, w: 9, h: 1 },
      { x: 134, y: 122, w: 13, h: 1 },
      { x: 132, y: 123, w: 17, h: 1 },
    ],
  });
  layers.push({
    fill: "#dccdaa",
    rects: [
      { x: 152, y: 121, w: 7, h: 1 },
      { x: 150, y: 122, w: 11, h: 1 },
      { x: 148, y: 123, w: 15, h: 1 },
    ],
  });
  layers.push({
    fill: "#d8c8a4",
    rects: [{ x: 132, y: 124, w: 36, h: 1 }],
  });
  layers.push({
    fill: "#e6dabd",
    rects: [{ x: 132, y: 125, w: 36, h: 1 }],
  });

  // Bookmark ribbon trailing out of the bottom edge, forked tail.
  layers.push({
    fill: "#a8433a",
    rects: [
      { x: 170, y: 142, w: 3, h: 13 },
      { x: 170, y: 155, w: 1, h: 3 },
    ],
  });
  layers.push({
    fill: "#832f27",
    rects: [
      { x: 173, y: 142, w: 1, h: 13 },
      { x: 173, y: 155, w: 1, h: 3 },
    ],
  });

  return layers;
}

const ART = buildArt();

function NotebookArt() {
  return (
    <svg
      className="nb-art"
      viewBox={`0 0 ${GW} ${GH}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {ART.map((layer, i) => (
        <g key={i} fill={layer.fill}>
          {layer.rects.map((r, j) => (
            <rect key={j} x={r.x} y={r.y} width={r.w} height={r.h} />
          ))}
        </g>
      ))}
    </svg>
  );
}

/** Page-area position as CSS vars (percentages of the book), consumed by the
 *  .nb-page / .nb-leaf rules. Derived from the same grid as the art. */
function pageVars(x: number): CSSProperties {
  const pct = (n: number, of: number) => `${((n / of) * 100).toFixed(3)}%`;
  return {
    "--pl": pct(x, GW),
    "--pt": pct(PAGE.y, GH),
    "--pw": pct(PAGE.w, GW),
    "--ph": pct(PAGE.h, GH),
  } as CSSProperties;
}

const LEFT_VARS = pageVars(LP_X);
const RIGHT_VARS = pageVars(RP_X);

/** "2026-07-19" → localized date fragment (display only). */
function fmtDate(dateStr: string, opts: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, opts);
}

/** Read-only page body for a saved entry (blocks format or legacy fields). */
function ReadPage({ entry }: { entry: JournalEntryDto }) {
  if (entry.blocks != null) {
    if (entry.blocks.length === 0) {
      return <p className="nb-empty">nothing written this day</p>;
    }
    return (
      <>
        {entry.blocks.map((b, i) => (
          <div key={i} className="nb-read-block">
            {b.label && <div className="nb-read-label">{b.label}</div>}
            <p className="nb-read-text">{b.text || "—"}</p>
          </div>
        ))}
      </>
    );
  }
  if (entry.mode === "free") {
    return <p className="nb-read-text">{entry.freeText || "—"}</p>;
  }
  return (
    <>
      <div className="nb-read-block">
        <div className="nb-read-label">succeeded</div>
        <p className="nb-read-text">{entry.successes || "—"}</p>
      </div>
      <div className="nb-read-block">
        <div className="nb-read-label">failed</div>
        <p className="nb-read-text">{entry.failures || "—"}</p>
      </div>
      <div className="nb-read-block">
        <div className="nb-read-label">tomorrow</div>
        <p className="nb-read-text">{entry.intentions || "—"}</p>
      </div>
    </>
  );
}

export function JournalNotebook({
  entries,
  streak,
  onSaved,
}: {
  entries: JournalEntryDto[];
  streak: number;
  onSaved: () => void;
}) {
  const today = localToday();
  const todayEntry = entries.find((e) => e.date === today) ?? null;

  // Page order: every entry day ascending, with today always the last page.
  const pages = useMemo(() => {
    const days = entries
      .map((e) => e.date)
      .filter((d) => d !== today)
      .sort();
    return [...days, today];
  }, [entries, today]);
  const byDate = useMemo(() => new Map(entries.map((e) => [e.date, e])), [entries]);

  const [index, setIndex] = useState(pages.length - 1); // open on today
  const [turning, setTurning] = useState<Turning>(null);
  const timers = useRef<number[]>([]);

  // Keep the index valid if the pages list changes shape underneath us.
  const safeIndex = Math.min(index, pages.length - 1);
  const date = pages[safeIndex];
  const isToday = date === today;

  useEffect(() => {
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const goTo = useCallback(
    (target: number) => {
      if (turning || target === safeIndex || target < 0 || target >= pages.length) return;
      const dir: 1 | -1 = target > safeIndex ? 1 : -1;
      const reduced =
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (reduced) {
        setIndex(target);
        return;
      }
      // Sprite-style turn: the leaf folds to the spine (out), then lands on
      // the far page (in). Content swaps at the moment the leaf lands —
      // the back of the landed leaf *is* the new page.
      setTurning({ dir, phase: "out" });
      timers.current.push(
        window.setTimeout(() => setTurning({ dir, phase: "in" }), TURN_MS)
      );
      timers.current.push(
        window.setTimeout(() => {
          setIndex(target);
          setTurning(null);
        }, TURN_MS * 2)
      );
    },
    [turning, safeIndex, pages.length]
  );

  // ← / → page turning, but never while the user is typing on the page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && t.closest("input, textarea, select")) return;
      if (e.key === "ArrowLeft") goTo(safeIndex - 1);
      if (e.key === "ArrowRight") goTo(safeIndex + 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, safeIndex]);

  // Right-page calendar: browsable month grid; days with pages are clickable
  // and flip straight to them. Follows the open page's month.
  const [viewMonth, setViewMonth] = useState<{ y: number; m: number }>(() => {
    const [y, m] = today.split("-").map(Number);
    return { y, m: m - 1 };
  });
  useEffect(() => {
    const [y, m] = date.split("-").map(Number);
    setViewMonth({ y, m: m - 1 });
  }, [date]);

  const calCells = useMemo(
    () => buildMonthCells(viewMonth.y, viewMonth.m),
    [viewMonth]
  );
  const pageSet = useMemo(() => new Set(pages), [pages]);

  function shiftMonth(delta: number) {
    setViewMonth(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }

  const entry = byDate.get(date) ?? null;

  // Which page area the leaf overlays, and which animation it runs.
  const leafClass = turning
    ? "nb-leaf " +
      (turning.phase === "out"
        ? turning.dir === 1
          ? "nb-leaf-fold-r"
          : "nb-leaf-fold-l"
        : turning.dir === 1
          ? "nb-leaf-land-l"
          : "nb-leaf-land-r")
    : "";
  const leafVars = turning
    ? (turning.phase === "out") === (turning.dir === 1)
      ? RIGHT_VARS
      : LEFT_VARS
    : undefined;

  return (
    <div className={`nb-wrap ${pixelFont.variable}`}>
      <div className={turning?.phase === "in" ? "nb-book nb-thump" : "nb-book"}>
        <NotebookArt />

        {/* Left page: the day itself. */}
        <section className="nb-page nb-page-l" style={LEFT_VARS}>
          <header className="nb-page-head">
            <span className="nb-head-day">
              {fmtDate(date, { month: "long", day: "numeric" })}
            </span>
            <span className="nb-head-sub">
              {fmtDate(date, { weekday: "long" })} · {date.slice(0, 4)}
            </span>
            {isToday && <span className="nb-stamp">today</span>}
          </header>

          <div className="nb-page-body">
            {isToday ? (
              <TodayJournal
                embedded
                key={todayEntry?.id ?? "new"}
                initial={todayEntry}
                onSaved={onSaved}
              />
            ) : entry ? (
              <ReadPage entry={entry} />
            ) : (
              <p className="nb-empty">nothing written this day</p>
            )}
          </div>

          {safeIndex > 0 && (
            <button
              type="button"
              className="nb-corner nb-corner-prev"
              aria-label="Turn back a page"
              title="turn back"
              disabled={!!turning}
              onClick={() => goTo(safeIndex - 1)}
            />
          )}
        </section>

        {/* Right page: the book's index — calendar, streak, page count. */}
        <aside className="nb-page nb-page-r" style={RIGHT_VARS}>
          <div className="nb-cal-head">
            <button
              type="button"
              className="nb-cal-nav"
              aria-label="Previous month"
              onClick={() => shiftMonth(-1)}
            >
              ‹
            </button>
            <span className="nb-cal-title">
              {monthLabel(`${viewMonth.y}-${String(viewMonth.m + 1).padStart(2, "0")}-01`)}
            </span>
            <button
              type="button"
              className="nb-cal-nav"
              aria-label="Next month"
              onClick={() => shiftMonth(1)}
            >
              ›
            </button>
          </div>
          <div className="nb-cal-grid">
            {WEEKDAYS.map((d, i) => (
              <span key={`w${i}`} className="nb-cal-dow">
                {d}
              </span>
            ))}
            {calCells.map((c) => {
              const hasPage = pageSet.has(c.key);
              const cls = [
                "nb-cal-day",
                c.outside ? "outside" : "",
                c.key === date ? "current" : "",
                c.key === today ? "today" : "",
                hasPage ? "has-page" : "",
              ]
                .filter(Boolean)
                .join(" ");
              return (
                <button
                  key={c.key}
                  type="button"
                  className={cls}
                  disabled={!hasPage}
                  title={hasPage ? (c.key === today ? "today" : "open this day") : undefined}
                  onClick={() => goTo(pages.indexOf(c.key))}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="nb-divider" aria-hidden />
          <div className="nb-stats">
            <span className="nb-stat">
              {streak > 0 ? (
                <>
                  <b>{streak}</b> day streak
                </>
              ) : (
                "no streak yet"
              )}
            </span>
            <span className="nb-stat">
              <b>{pages.length}</b> page{pages.length === 1 ? "" : "s"}
            </span>
          </div>
          {!isToday && (
            <button
              type="button"
              className="nb-today-btn"
              onClick={() => goTo(pages.length - 1)}
            >
              turn to today ↦
            </button>
          )}
          <div className="nb-pageno">
            {safeIndex + 1} / {pages.length}
          </div>

          {safeIndex < pages.length - 1 && (
            <button
              type="button"
              className="nb-corner nb-corner-next"
              aria-label="Turn forward a page"
              title="turn forward"
              disabled={!!turning}
              onClick={() => goTo(safeIndex + 1)}
            />
          )}
        </aside>

        {/* The turning leaf (only exists mid-flip). */}
        {turning && <div className={leafClass} style={leafVars} aria-hidden />}
      </div>

      {/* Narrow screens: the spread stacks into cards; turn with these. */}
      <div className="nb-mnav">
        <button
          type="button"
          disabled={safeIndex === 0 || !!turning}
          onClick={() => goTo(safeIndex - 1)}
        >
          ← earlier
        </button>
        <button
          type="button"
          disabled={safeIndex === pages.length - 1 || !!turning}
          onClick={() => goTo(safeIndex + 1)}
        >
          later →
        </button>
      </div>
    </div>
  );
}
