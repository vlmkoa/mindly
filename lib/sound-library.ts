/** Universal synthesized ambient library — recipes consumed by the audio engine. */

export type SoundPreset = {
  id: string;
  label: string;
  description: string;
};

export const AMBIENT_PRESETS: SoundPreset[] = [
  {
    id: "deep-drone",
    label: "Deep drone",
    description: "Low stacked sine tones — ground without melody.",
  },
  {
    id: "wind",
    label: "Wind",
    description: "Band-passed noise that slowly breathes.",
  },
  {
    id: "still-water",
    label: "Still water",
    description: "Soft lowpass hush under a quiet fundamental.",
  },
];

export const BELL_TYPES = [
  { id: "small" as const, label: "Small bell", description: "Bright, short decay" },
  { id: "large" as const, label: "Large bell", description: "Deep, long decay" },
  { id: "wood" as const, label: "Wood block", description: "Dry percussive tap" },
];

export const DURATION_OPTIONS = [
  { sec: 5 * 60, label: "5 min" },
  { sec: 10 * 60, label: "10 min" },
  { sec: 15 * 60, label: "15 min" },
  { sec: 20 * 60, label: "20 min" },
  { sec: 30 * 60, label: "30 min" },
  { sec: 45 * 60, label: "45 min" },
  { sec: 60 * 60, label: "60 min" },
];
