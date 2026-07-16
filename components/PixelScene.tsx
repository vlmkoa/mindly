"use client";

/**
 * Pixel-art valley: layered hills, pines on the sides, a creek down the middle,
 * and a sun or moon in the sky. Every color is a CSS variable, so the active
 * theme (including day-cycle and custom) recolors the same geometry for free.
 *
 * Shapes are built from grid-aligned <rect>s on a 96x28 viewBox with
 * crispEdges rendering, so it reads as pixel art at any width.
 */

import { useTheme } from "@/components/ThemeProvider";

const W = 96;
const H = 28;
const SKY_H = 13; // horizon line

type Rect = { x: number; y: number; w: number; h: number };

function gauss(x: number, center: number, spread: number): number {
  return Math.exp(-(((x - center) / spread) ** 2));
}

// Column-fill helper: one rect per x column from top(x) down to the bottom.
function columns(topFn: (x: number) => number, bottom = H): Rect[] {
  const out: Rect[] = [];
  for (let x = 0; x < W; x++) {
    const top = Math.round(topFn(x));
    out.push({ x, y: top, w: 1, h: bottom - top });
  }
  return out;
}

// Far-hill surface height at column x — the creek derives its start from this
// so the water always meets the land exactly, whatever the hill shape.
function farHillTop(x: number): number {
  return SKY_H - 4 * gauss(x, 20, 15) - 4 * gauss(x, 76, 15) - 1;
}

const farHills = columns(farHillTop);
const nearHills = columns(
  (x) => SKY_H + 3 - 5 * gauss(x, 8, 10) - 5 * gauss(x, 88, 10)
);

// Creek: a band down the middle, widening toward the viewer (perspective).
// Starts exactly on the far-hill surface at the center column (no sky overlap)
// and is drawn AFTER the near hills so the foreground never cuts it off.
function creekRects(): Rect[] {
  const out: Rect[] = [];
  const top = Math.round(farHillTop(W / 2));
  for (let y = top; y < H; y++) {
    const t = (y - top) / (H - top); // 0 at horizon, 1 at foreground
    const halfW = 1 + t * 5.5;
    const cx = W / 2;
    out.push({ x: Math.round(cx - halfW), y, w: Math.round(halfW * 2), h: 1 });
  }
  return out;
}

// A pixel pine: stacked rows forming a triangle, plus a short trunk.
function pine(baseX: number, baseY: number, size: number): Rect[] {
  const out: Rect[] = [];
  for (let i = 0; i < size; i++) {
    const halfW = 1 + i * 0.8;
    out.push({
      x: Math.round(baseX - halfW),
      y: baseY - size + i,
      w: Math.round(halfW * 2) + 1,
      h: 1,
    });
  }
  out.push({ x: baseX, y: baseY, w: 1, h: 1 }); // trunk
  return out;
}

// Blocky filled disc for the sun / moon.
function disc(cx: number, cy: number, r: number): Rect[] {
  const out: Rect[] = [];
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        out.push({ x: Math.round(cx + x), y: Math.round(cy + y), w: 1, h: 1 });
      }
    }
  }
  return out;
}

// Deterministic star field (fixed positions, no layout shift between renders).
const STAR_SEEDS: [number, number][] = [
  [6, 3], [14, 6], [22, 2], [31, 5], [39, 3], [8, 9], [19, 10],
  [58, 4], [66, 2], [73, 6], [81, 3], [90, 5], [86, 9], [50, 2],
  [44, 7], [70, 9], [12, 4], [34, 8], [62, 7], [78, 8],
];

function Rects({ list, fill }: { list: Rect[]; fill: string }) {
  return (
    <>
      {list.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={fill} />
      ))}
    </>
  );
}

export function PixelScene({ fullBleed = false }: { fullBleed?: boolean }) {
  const { scene } = useTheme();
  if (!scene.hasScene) return null;
  // The framed banner renders only in the non-immersive scene themes; the
  // full-bleed instance renders only when the immersive theme is active.
  if (fullBleed !== scene.fullBleed) return null;

  const cx = scene.x * W;
  const cy = scene.y * SKY_H;
  const r = scene.celestial === "sun" ? 4 : 3.5;

  // Left/right pines seated on the near hillsides.
  const trees = [
    ...pine(9, 19, 5),
    ...pine(15, 21, 4),
    ...pine(87, 19, 5),
    ...pine(81, 21, 4),
  ];

  return (
    <div className={fullBleed ? "pixel-scene pixel-scene-full" : "pixel-scene"} aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice">
        {/* glow halo behind the celestial body */}
        <rect
          x={cx - r - 2}
          y={cy - r - 2}
          width={(r + 2) * 2}
          height={(r + 2) * 2}
          fill="var(--celestial-glow)"
        />
        {scene.stars && <Rects list={STAR_SEEDS.map(([x, y]) => ({ x, y, w: 1, h: 1 }))} fill="var(--star)" />}
        <Rects list={disc(cx, cy, r)} fill="var(--celestial)" />
        {/* one crater notch to make the moon read as a moon */}
        {scene.celestial === "moon" && (
          <rect x={cx + 0.5} y={cy - 1.5} width={2} height={2} fill="var(--sky)" opacity={0.35} />
        )}

        <Rects list={farHills} fill="var(--hill-far)" />
        <Rects list={nearHills} fill="var(--hill-near)" />
        {/* creek runs over the landforms: from the far hills to the viewer */}
        <Rects list={creekRects()} fill="var(--creek)" />
        <Rects
          list={[
            { x: 47, y: 18, w: 1, h: 1 },
            { x: 49, y: 21, w: 1, h: 1 },
            { x: 46, y: 24, w: 1, h: 1 },
            { x: 50, y: 26, w: 1, h: 1 },
          ]}
          fill="var(--creek-hi)"
        />
        <Rects list={trees} fill="var(--tree)" />
      </svg>
    </div>
  );
}
