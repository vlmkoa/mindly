"use client";

/**
 * Immersive scenes — one per tab, all "zen viewpoints" around the same temple
 * on a hill. The composition rule that keeps them non-intrusive: detail lives
 * at the periphery (top strip, bottom ground, side thirds); the center corridor
 * where the UI column sits stays calm sky/water/sand. Each scene also echoes
 * its tab: the planner's rock garden is raked into a calendar-like grid, the
 * journal sits at a writing desk, the koan page faces a mirror-still pond.
 *
 *   /          home     — the engawa porch: tea + steam, cushion, blossom tree
 *   /planner   planner  — karesansui rock garden raked into rows, day-stones
 *   /meditate  meditate — open nature: mountain lake, sitting stone
 *   /journal   journal  — writing desk: paper, ink strokes, inkstone, brush
 *   /koan      koan     — mirror-still pond, moon-glade, stepping stones
 *   /sobriety  sobriety — hilltop cairn (stacked stones) and a young sapling
 *
 * The sky is the CSS gradient behind the SVG; the sun/moon and stars are drawn
 * programmatically from the theme's scene state, so they track your local time.
 * Wood is tinted by theme vars (--wood*): sunlit by day, moonlit-dark at night.
 *
 * ─── HOW TO EDIT THE PIXEL ART ───────────────────────────────────────────────
 * Each scene is a grid: one string per row, one character per pixel.
 *   • Every row must be the same length (56). Keep them aligned.
 *   • Each character maps to a fill in COLORS. A space = see-through sky.
 *   • var(--...) fills follow the theme / time of day; hex fills are fixed.
 *   • New element: pick an unused character, add it to COLORS, paint it in.
 * Steam is animated in <Smoke/> (home only); sun/moon/stars are drawn before
 * the grid so scene pixels occlude them naturally.
 */

import { usePathname } from "next/navigation";
import { useTheme } from "@/components/ThemeProvider";

const COLORS: Record<string, string> = {
  "#": "var(--wood-dark)", // beams, posts, deck edges
  _: "var(--wood)", // deck / desk planks
  "-": "var(--wood-seam)", // plank seams
  H: "var(--hill-far)", // distant hills / mountains
  N: "var(--hill-near)", // near slopes, banks, grass
  t: "var(--tree)", // foliage, reeds
  T: "#4a3320", // trunks
  w: "var(--creek)", // water
  W: "var(--creek-hi)", // water highlight / moon-glade
  S: "#8f8a80", // stone
  s: "#605b52", // stone shadow
  ".": "#d9cfae", // raked sand
  r: "#c3b489", // rake lines
  p: "#ece4cc", // paper
  b: "#2b2118", // ink, brush, birds, wind chime
  M: "#9c5847", // cushion
  m: "#6f3c30", // cushion shadow
  c: "#e6ddcb", // tea cup body
  u: "#c3b79c", // cup rim
  f: "#d8a0a8", // blossom petals
  "%": "rgba(255, 255, 255, 0.3)", // cloud wisps
};

// All grids are 56 × 30.
const SCENES: Record<string, string[]> = {
  // ── Home: the engawa porch. Eave above, posts at the sides, blossom branch
  //    left, wind chime right; tea + steam and cushion on the deck. ──────────
  home: [
    "########################################################",
    "########################################################",
    "   #                                                #   ",
    "   #                                            b   #   ",
    "   #                                           bbb  #   ",
    "   #                                                #   ",
    "   #                              b   b             #   ",
    "   #                                                #   ",
    "   #  tttt                                          #   ",
    "   # ttfftt                                         #   ",
    "   #tfttt                                           #   ",
    "   #  t                                             #   ",
    "   #      f                                         #   ",
    "   #                                                #   ",
    "   #         f                                      #   ",
    "   #          HH                    HHH             #   ",
    "   #      HHHHHH        HHHH      HHHHHH            #   ",
    "   #  HHHHHHHHHHHHHHHHHHHH HHHHHHHHHHHHHHHHH        #   ",
    "   #HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH#   ",
    "   #NNHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHNN#   ",
    "   #NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN#   ",
    "   #NNNtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNtNNNNNNN#   ",
    "########################################################",
    "________________________________________________________",
    "________________________________________________________",
    "--------------------------------------------------------",
    "____________uu____bb__________________MMMMMMMMMM________",
    "____________cc___bbb__________________MMMMMMMMMM________",
    "______________________________________mmmmmmmmmm________",
    "________________________________________________________",
  ],

  // ── Planner: karesansui garden raked into calendar-like rows; small stones
  //    mark the days; a large stone rests at the bottom corner. ──────────────
  planner: [
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                              %%%                       ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "      HH                              HHH               ",
    "    HHHHH                          HHHHHH               ",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "########################################################",
    "........................................................",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "........................................................",
    "......S.......S.......S.......S.......S.......S.........",
    "........................................................",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "........................................................",
    "......S.......S.......S.......S.......S.......S.........",
    "........................................................",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "........................................................",
    "......S.......S.......S.......S.......S.......S.........",
    "........................................................",
    "rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr",
    "........................................................",
    "....SSSS................................................",
    "...SSSSSS...............................................",
  ],

  // ── Meditate: pure nature — a mountain lake under a big sky, a flat sitting
  //    stone on the near shore. ──────────────────────────────────────────────
  meditate: [
    "                                                        ",
    "                                                        ",
    "          %%%%                            %%%           ",
    "                                                        ",
    "                                    %%%%                ",
    "                                                        ",
    "                    b   b                               ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "    HH              HHH                        HH       ",
    "   HHHH            HHHHH                      HHHH      ",
    "  HHHHHH         HHHHHHHHH                  HHHHHH      ",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "NNNNNNNNNNHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNtNNNNNNNNNNtNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwWwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwWwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "NNNNNNwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNSSSSNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNSSSSSSNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNssssssNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
  ],

  // ── Journal: a low writing desk — paper with ink strokes, inkstone, brush;
  //    a blossom branch reaches in from the top right. ───────────────────────
  journal: [
    "                                                        ",
    "                                                        ",
    "                                        tttt            ",
    "                                      tttttt            ",
    "                                         ttt            ",
    "                                            t           ",
    "                                                        ",
    "                                          f             ",
    "                                                        ",
    "                                                        ",
    "                                       f                ",
    "        HHH                         HHHH                ",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "########################################################",
    "________________________________________________________",
    "--------------------------------------------------------",
    "__________ppppppppppppppppp_____________________________",
    "__________ppbpppppbpppppppp_____________________________",
    "__________ppppppppppppppppp_____________________________",
    "__________pbppppbpppppppppp_____bbbb____________________",
    "__________ppppppppppppppppp_____bbbb____________________",
    "__________ppppppppppppppppp_____ssss____________________",
    "__________ppppppppppppppppp_____________________________",
    "______________________________bbbbbb____________________",
    "--------------------------------------------------------",
    "________________________________________________________",
    "________________________________________________________",
    "________________________________________________________",
  ],

  // ── Koan: the mirror — a still pond holding a moon-glade, stepping stones,
  //    reeds on the near bank. ───────────────────────────────────────────────
  koan: [
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "              %%%                                       ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "            HH                            HH            ",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwWWWWwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwWWwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwWWWWwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwSwwwwwwwSwwwwwwwSwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "wwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwww",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNtNtNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNtNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
  ],

  // ── Sobriety: a hilltop cairn — stones stacked one at a time — beside a
  //    young sapling. Small path stones lead away. ───────────────────────────
  sobriety: [
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "        %%%                                             ",
    "                                                        ",
    "                                            b  b        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "                                                        ",
    "    HH                                      HHH         ",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "HHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHHH",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNtttNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNtttttNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNSNNNNNNNNNNNNNNNNNNNNNNNNtttNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNSSSNNNNNNNNNNNNNNNNNNNNNNNNTNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNSSSSSNNNNNNNNNNNNNNNNNNNNNNNTNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNSSSSSSSNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNsssssssNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNSNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNSNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
    "NNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNNN",
  ],
};

// Route → scene. First match wins; anything else (login, signup) gets home.
const SCENE_FOR_PATH: [string, string][] = [
  ["/planner", "planner"],
  ["/meditate", "meditate"],
  ["/journal", "journal"],
  ["/koan", "koan"],
  ["/sobriety", "sobriety"],
];

function sceneKeyFor(pathname: string): string {
  for (const [prefix, key] of SCENE_FOR_PATH) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return key;
  }
  return "home";
}

// Fixed star field in the upper sky (transparent by day via --star).
const STAR_SEEDS: [number, number][] = [
  [7, 3], [13, 6], [19, 2], [25, 5], [31, 3], [37, 6], [43, 2], [49, 4],
  [10, 8], [22, 9], [34, 7], [46, 8], [16, 4], [40, 4], [28, 2], [52, 6],
];

// Steam rising from the home scene's cup (rim at x 12–13, row 26).
function Smoke() {
  const puffs = [
    { x: 12.2, begin: "0s" },
    { x: 13.0, begin: "1.3s" },
    { x: 12.6, begin: "2.7s" },
  ];
  return (
    <g>
      {puffs.map((p, i) => (
        <rect key={i} x={p.x} y={25} width={0.9} height={0.9} fill="#e9e3d6" opacity={0}>
          <animate attributeName="y" values="25;14" dur="4s" begin={p.begin} repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.45;0" dur="4s" begin={p.begin} repeatCount="indefinite" />
          <animate
            attributeName="x"
            values={`${p.x};${p.x - 0.7};${p.x + 0.7};${p.x}`}
            dur="4s"
            begin={p.begin}
            repeatCount="indefinite"
          />
        </rect>
      ))}
    </g>
  );
}

export function ZenScene() {
  const { scene } = useTheme();
  const pathname = usePathname();
  if (!scene.hasScene || !scene.fullBleed) return null;

  const key = sceneKeyFor(pathname);
  const art = SCENES[key];
  const gridW = art[0].length;
  const gridH = art.length;

  // Sun/moon along its arc across the open sky band.
  const r = scene.celestial === "sun" ? 3 : 2.5;
  const cx = 5 + scene.x * (gridW - 10);
  const cy = 3 + scene.y * 8;

  const cells: React.ReactNode[] = [];
  for (let y = 0; y < gridH; y++) {
    const row = art[y];
    for (let x = 0; x < row.length; x++) {
      const fill = COLORS[row[x]];
      if (!fill) continue; // space / unknown = transparent sky
      cells.push(<rect key={`${y}-${x}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  }

  const disc: React.ReactNode[] = [];
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx * dx + dy * dy <= r * r) {
        disc.push(
          <rect
            key={`c${dx}-${dy}`}
            x={Math.round(cx + dx)}
            y={Math.round(cy + dy)}
            width={1}
            height={1}
            fill="var(--celestial)"
          />
        );
      }
    }
  }

  return (
    <div className="pixel-scene pixel-scene-full" aria-hidden>
      <svg viewBox={`0 0 ${gridW} ${gridH}`} preserveAspectRatio="xMidYMid slice">
        {/* sky objects first — the grid occludes them naturally */}
        <rect
          x={cx - r - 1.5}
          y={cy - r - 1.5}
          width={(r + 1.5) * 2}
          height={(r + 1.5) * 2}
          fill="var(--celestial-glow)"
        />
        {scene.stars &&
          STAR_SEEDS.map(([x, y], i) => (
            <rect key={`s${i}`} x={x} y={y} width={1} height={1} fill="var(--star)" />
          ))}
        {disc}
        {cells}
        {key === "home" && <Smoke />}
      </svg>
    </div>
  );
}
