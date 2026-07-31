export type AddictionPreset = {
  type: string;
  label: string;
};

export const ADDICTION_PRESETS: AddictionPreset[] = [
  // Split 2026-07: previously one combined "Masturbation / porn" preset.
  // Existing tracked rows keep their stored label; only new picks change.
  { type: "masturbation", label: "Masturbation" },
  { type: "porn", label: "Porn" },
  { type: "caffeine", label: "Caffeine" },
  { type: "nicotine_cigs", label: "Nicotine — cigarettes" },
  { type: "nicotine_vape", label: "Nicotine — vape" },
  { type: "alcohol", label: "Alcohol" },
  { type: "cannabis", label: "Cannabis" },
  { type: "cocaine", label: "Cocaine" },
  { type: "heroin", label: "Heroin / opioids" },
  { type: "gambling", label: "Gambling" },
  { type: "social_media", label: "Social media" },
  { type: "sugar", label: "Sugar" },
  { type: "shopping", label: "Shopping" },
];
