/**
 * Shared inline SVG glyphs — quiet, zen-leaning line icons drawn in
 * `currentColor` so they inherit whatever text color surrounds them.
 * All are decorative (aria-hidden); meaning is always carried by the label.
 */

import { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base({ size = 15, ...rest }: IconProps): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.5,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    ...rest,
  };
}

/** Enso — the open zen circle. Silence / meditation. */
export function IconEnso(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M14.5 3.4 A9 9 0 1 0 20 8.5" />
    </svg>
  );
}

/** Layered still-water waves. Ambient bed. */
export function IconWaves(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 9c2.5-2 5-2 7.5 0s5 2 7.5 0" />
      <path d="M3 15c2.5-2 5-2 7.5 0s5 2 7.5 0" />
    </svg>
  );
}

/** Trailing wind lines. */
export function IconWind(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M3 8h11a2.5 2.5 0 1 0-2.5-2.5" />
      <path d="M3 13h15a2.5 2.5 0 1 1-2.5 2.5" />
      <path d="M3 18h7" />
    </svg>
  );
}

/** Three stacked drone tones. */
export function IconDrone(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 8h16" />
      <path d="M6 12h12" />
      <path d="M8 16h8" />
    </svg>
  );
}

/** Temple bell. */
export function IconBell(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4c-3.5 0-5.5 2.6-5.5 6v3.5L5 17h14l-1.5-3.5V10c0-3.4-2-6-5.5-6Z" />
      <path d="M10.5 20a1.5 1.5 0 0 0 3 0" />
    </svg>
  );
}

/** Wood block with a resonance slit. */
export function IconWood(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4.5" y="7" width="15" height="10" rx="2.5" />
      <path d="M8.5 12h7" />
    </svg>
  );
}

/** Single sine wave — mono beat. */
export function IconSine(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 12c2-6 4.5-6 6.5 0s4.5 6 6.5 0 4.5-6 6 0" />
    </svg>
  );
}

/** Two offset sine waves — binaural. */
export function IconBinaural(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M2.5 9.5c2-5 4.5-5 6.5 0s4.5 5 6.5 0 4.5-5 6 0" />
      <path d="M2.5 15.5c2-5 4.5-5 6.5 0s4.5 5 6.5 0 4.5-5 6 0" opacity={0.55} />
    </svg>
  );
}

/** Three vertical faders — tailor your own. */
export function IconSliders(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 4v16M12 4v16M18 4v16" />
      <circle cx="6" cy="9" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.8" fill="currentColor" stroke="none" />
      <circle cx="18" cy="7" r="1.8" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Lotus — meditation widget. */
export function IconLotus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 18c-1.8-1.6-2.8-3.8-2.8-6 0-2.6 1.2-5 2.8-6.5 1.6 1.5 2.8 3.9 2.8 6.5 0 2.2-1 4.4-2.8 6Z" />
      <path d="M12 18c-3.2.4-6.3-.8-8.2-3.2 1.5-1 3.3-1.5 5.2-1.4" />
      <path d="M12 18c3.2.4 6.3-.8 8.2-3.2-1.5-1-3.3-1.5-5.2-1.4" />
    </svg>
  );
}

/** Leaf — sobriety widget. */
export function IconLeaf(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M19 5c-8 0-13 4-13 10 0 2 1 4 1 4s6 1 10-3 2-11 2-11Z" />
      <path d="M6 20C9 14 13 10 17 7" />
    </svg>
  );
}

/** Pen nib — journal widget. */
export function IconPen(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="m5 19 2.5-7.5L16 4l4 4-7.5 8.5L5 19Z" />
      <path d="m5 19 5.5-5.5" />
      <circle cx="11.5" cy="12.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** Concentric ripples — the koan mirror. */
export function IconRipple(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 5.5a6.5 6.5 0 0 1 6.5 6.5M12 18.5A6.5 6.5 0 0 1 5.5 12" />
      <path d="M12 2a10 10 0 0 1 10 10M12 22A10 10 0 0 1 2 12" opacity={0.5} />
    </svg>
  );
}

/** Rising sun — today's planner. */
export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 17h16" />
      <path d="M7.5 13.5a4.5 4.5 0 0 1 9 0" />
      <path d="M12 5.5V7.5M5.5 9l1.4 1.4M18.5 9l-1.4 1.4" />
    </svg>
  );
}

/** Month grid — long-term planner. */
export function IconCalendar(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="5.5" width="16" height="15" rx="2" />
      <path d="M4 10.5h16M8.5 3.5v4M15.5 3.5v4" />
      <circle cx="9" cy="15" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="15" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
