export type AddictionPreset = {
  type: string;
  label: string;
};

export const ADDICTION_PRESETS: AddictionPreset[] = [
  { type: "masturbation", label: "Masturbation / porn" },
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
