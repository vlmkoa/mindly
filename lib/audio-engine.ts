/**
 * Meditation audio via the Web Audio API — ambient beds, bells, and mono/
 * binaural beats are synthesized live. Bells can optionally use a recording
 * dropped in public/sounds/ (see BELL_SAMPLE_URLS); playBell falls back to
 * synthesis when no sample is present.
 *
 * Module-level helpers (`startAmbientNodes`, `startFrequencyTone`, `playBell`,
 * `previewAmbient`) are shared by the session engine and the short UI previews,
 * so a preview always sounds identical to the real session.
 */

export type BellType = "small" | "large" | "wood";

export type SoundConfig = {
  music: { enabled: boolean; presetId: string | null };
  bells: {
    enabled: boolean;
    type: BellType;
    intervalMin: number; // minutes between bells; 0 = start/end only
    strikeStart: boolean;
    strikeEnd: boolean;
  };
  frequencies: {
    enabled: boolean;
    mode: "mono" | "binaural";
    monoHz: number;
    leftHz: number;
    rightHz: number;
  };
};

export const DEFAULT_SOUND_CONFIG: SoundConfig = {
  music: { enabled: false, presetId: null },
  bells: {
    enabled: false,
    type: "small",
    intervalMin: 5,
    strikeStart: true,
    strikeEnd: true,
  },
  frequencies: {
    enabled: false,
    mode: "mono",
    monoHz: 174,
    leftHz: 432,
    rightHz: 432,
  },
};

type AmbientRecipe = {
  id: string;
  label: string;
  description: string;
};

export type StopHandle = () => void;

const AMBIENT_VOLUME = 0.18;
const FREQ_VOLUME = 0.12;

function createNoiseBuffer(ctx: AudioContext, seconds = 2): AudioBuffer {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

/**
 * A struck-metal/wood voice. The realism comes from three things a naive
 * harmonic sum lacks:
 *  - INHARMONIC partials (ratios are non-integer — a real bell's tierce sits a
 *    minor third above the prime at ~1.19, the nominal at ~2.0, etc.). Integer
 *    multiples read as a synth "beep"; these ratios read as metal.
 *  - a NOISE STRIKE transient at the attack (the clapper/mallet contact), which
 *    gives the onset its body before the partials ring out.
 *  - per-strike DETUNE so no two hits are identical (the natural warble).
 */
type BellVoice = {
  base: number; // Hz of the prime partial (ratio 1.0)
  detune: number; // max random frequency wobble per strike, as a fraction
  osc: OscillatorType;
  master: number;
  partials: { ratio: number; gain: number; decay: number }[];
  strike: { gain: number; decay: number; filterHz: number; filterQ: number };
};

function bellVoice(type: BellType): BellVoice {
  switch (type) {
    case "large":
      // Deep temple bell — the classic inharmonic church-bell partial series
      // (hum · prime · tierce · quint · nominal · upper partials), long decay.
      return {
        base: 110,
        detune: 0.004,
        osc: "sine",
        master: 0.7,
        partials: [
          { ratio: 0.5, gain: 0.3, decay: 6.0 }, // hum
          { ratio: 1.0, gain: 0.42, decay: 5.0 }, // prime
          { ratio: 1.19, gain: 0.24, decay: 4.0 }, // tierce (minor third) — the signature
          { ratio: 1.5, gain: 0.16, decay: 3.2 }, // quint
          { ratio: 2.0, gain: 0.18, decay: 3.0 }, // nominal
          { ratio: 2.55, gain: 0.09, decay: 1.8 },
          { ratio: 3.0, gain: 0.06, decay: 1.3 },
          { ratio: 4.2, gain: 0.04, decay: 0.9 },
        ],
        strike: { gain: 0.12, decay: 0.06, filterHz: 500, filterQ: 1.2 },
      };
    // "wood" is not a partial stack — sine partials sound metallic. It's
    // synthesized separately by playWoodBlock (modal filtered noise). See playBell.
    case "small":
    default:
      // Bright singing-bowl-ish bell — some inharmonicity, medium decay.
      return {
        base: 528,
        detune: 0.005,
        osc: "sine",
        master: 0.65,
        partials: [
          { ratio: 1.0, gain: 0.4, decay: 1.8 },
          { ratio: 2.0, gain: 0.2, decay: 1.1 },
          { ratio: 2.4, gain: 0.14, decay: 0.9 },
          { ratio: 3.0, gain: 0.08, decay: 0.7 },
          { ratio: 4.2, gain: 0.05, decay: 0.5 },
        ],
        strike: { gain: 0.1, decay: 0.03, filterHz: 2600, filterQ: 1.5 },
      };
  }
}

// ─── Optional sampled bells ──────────────────────────────────────────────────
// Drop a recording in public/sounds/ to replace a synthesized bell (a wood
// block is notoriously hard to synthesize). playBell prefers the sample and
// falls back to synthesis if the file is missing or fails to decode.

const BELL_SAMPLE_URLS: Partial<Record<BellType, string>> = {
  wood: "/sounds/wood.mp3",
};
const BELL_SAMPLE_GAIN = 0.9;

// AudioBuffer once decoded; `null` means "tried and unavailable → use synth".
const sampleBuffers = new Map<BellType, AudioBuffer | null>();
const sampleLoading = new Set<BellType>();

/** Fetch + decode a bell sample into a cached buffer, at most once per type. */
function preloadBellSample(ctx: AudioContext, type: BellType): void {
  const url = BELL_SAMPLE_URLS[type];
  if (!url || sampleBuffers.has(type) || sampleLoading.has(type)) return;
  sampleLoading.add(type);
  fetch(url)
    .then((r) => {
      if (!r.ok) throw new Error(`bell sample ${url} → ${r.status}`);
      return r.arrayBuffer();
    })
    .then((bytes) => ctx.decodeAudioData(bytes))
    .then((decoded) => sampleBuffers.set(type, decoded))
    .catch(() => sampleBuffers.set(type, null)) // remember: fall back to synth
    .finally(() => sampleLoading.delete(type));
}

/**
 * Wood block: a struck damped-wood "tok". Summed sine partials sound metallic
 * because each is a pure pitch that rings; real wood is a noisy impact exciting
 * a few fast, heavily-damped resonances. So we drive resonant band-pass filters
 * with a short noise burst (modal / subtractive synthesis) — filtered noise
 * reads as a physical knock on wood, not a tone.
 */
function playWoodBlock(ctx: AudioContext, when: number): void {
  const master = ctx.createGain();
  master.gain.value = 0.9;
  // Keep it bright — a wood block is crisp. Only shave the very harsh top so it
  // doesn't fizz; do NOT dull it (that was the mistake last pass).
  const tone = ctx.createBiquadFilter();
  tone.type = "lowpass";
  tone.frequency.value = 3800;
  master.connect(tone);
  tone.connect(ctx.destination);

  // Shared noise excitation for the resonant body.
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.2);
  noise.start(when);
  noise.stop(when + 0.2);

  // The hollow "tock": ONE dominant pitched resonance plus a bright overtone,
  // both fairly high-Q so they RING briefly (the short echo of the hollow body).
  // What keeps this wood and not a bell: only two clear partials and a short
  // decay — a bell is many inharmonic partials ringing long. A touch of low
  // weight underneath gives the body without dulling the crisp top.
  const modes = [
    { freq: 620, q: 22, gain: 0.5, decay: 0.14 }, // body tock + short ringing echo
    { freq: 1120, q: 14, gain: 0.16, decay: 0.07 }, // hollow brightness
    { freq: 250, q: 4, gain: 0.18, decay: 0.04 }, // faint low weight
  ];
  for (const m of modes) {
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = m.freq;
    bp.Q.value = m.q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(m.gain, when);
    g.gain.exponentialRampToValueAtTime(0.0004, when + m.decay);
    noise.connect(bp);
    bp.connect(g);
    g.connect(master);
  }

  // The sharp, bright "cl-" of the clack: a short high-passed noise burst. This
  // crispness is the wood-block signature — bringing it back (brighter than the
  // dull thump) is the point.
  const click = ctx.createBufferSource();
  click.buffer = createNoiseBuffer(ctx, 0.03);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1500;
  const cg = ctx.createGain();
  cg.gain.setValueAtTime(0.32, when);
  cg.gain.exponentialRampToValueAtTime(0.0004, when + 0.02);
  click.connect(hp);
  hp.connect(cg);
  cg.connect(master);
  click.start(when);
  click.stop(when + 0.03);
}

export function playBell(ctx: AudioContext, type: BellType, when = ctx.currentTime): void {
  if (ctx.state === "suspended") void ctx.resume();

  // Prefer a real recording when one has loaded for this bell type.
  const sample = sampleBuffers.get(type);
  if (sample) {
    const src = ctx.createBufferSource();
    src.buffer = sample;
    const g = ctx.createGain();
    g.gain.value = BELL_SAMPLE_GAIN;
    src.connect(g);
    g.connect(ctx.destination);
    src.start(when);
    return;
  }
  // Not loaded yet (or absent) — kick off a load for next time, synth for now.
  preloadBellSample(ctx, type);

  if (type === "wood") {
    playWoodBlock(ctx, when);
    return;
  }
  const v = bellVoice(type);
  const master = ctx.createGain();
  master.gain.value = v.master;
  master.connect(ctx.destination);

  // Strike transient: a short band-passed noise burst. Without this the attack
  // is a pure fade-in and sounds electronic; the noise gives it a physical hit.
  const noise = ctx.createBufferSource();
  noise.buffer = createNoiseBuffer(ctx, 0.25);
  const nf = ctx.createBiquadFilter();
  nf.type = "bandpass";
  nf.frequency.value = v.strike.filterHz;
  nf.Q.value = v.strike.filterQ;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(v.strike.gain, when);
  ng.gain.exponentialRampToValueAtTime(0.0005, when + v.strike.decay);
  noise.connect(nf);
  nf.connect(ng);
  ng.connect(master);
  noise.start(when);
  noise.stop(when + v.strike.decay + 0.05);

  // Inharmonic partials, with a small shared per-strike detune for warble.
  const wobble = 1 + (Math.random() - 0.5) * v.detune;
  for (const p of v.partials) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = v.osc;
    osc.frequency.value = v.base * p.ratio * wobble;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p.gain, when + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0004, when + p.decay);
    osc.connect(g);
    g.connect(master);
    osc.start(when);
    osc.stop(when + p.decay + 0.05);
  }
}

/**
 * Builds the graph for one ambient preset behind a master gain node.
 * Returns the master (so callers can fade it) and a stop handle that
 * silences and disconnects everything.
 */
function startAmbientNodes(
  ctx: AudioContext,
  presetId: string
): { master: GainNode; stop: StopHandle } {
  const master = ctx.createGain();
  master.gain.value = AMBIENT_VOLUME;
  master.connect(ctx.destination);

  const sources: { stop: () => void }[] = [];

  if (presetId === "deep-drone") {
    const freqs = [55, 82.5, 110];
    freqs.forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      g.gain.value = 0.35 / (i + 1);
      osc.connect(g);
      g.connect(master);
      osc.start();
      sources.push(osc);
    });
  } else if (presetId === "wind") {
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 3);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 400;
    filter.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    src.connect(filter);
    filter.connect(master);
    src.start();
    lfo.start();
    sources.push(src, lfo);
  } else {
    // still-water default: soft filtered noise + slow sine
    const src = ctx.createBufferSource();
    src.buffer = createNoiseBuffer(ctx, 4);
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 220;
    const osc = ctx.createOscillator();
    const og = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 65;
    og.gain.value = 0.15;
    src.connect(filter);
    filter.connect(master);
    osc.connect(og);
    og.connect(master);
    src.start();
    osc.start();
    sources.push(src, osc);
  }

  return {
    master,
    stop() {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          /* already stopped */
        }
      }
      try {
        master.disconnect();
      } catch {
        /* */
      }
    },
  };
}

/**
 * Plays a short, faded snippet of an ambient preset — used as a UI preview.
 * Returns a stop handle for cutting it off early.
 */
export function previewAmbient(
  ctx: AudioContext,
  presetId: string,
  seconds = 3
): StopHandle {
  if (ctx.state === "suspended") void ctx.resume();
  const { master, stop } = startAmbientNodes(ctx, presetId);
  const now = ctx.currentTime;
  master.gain.setValueAtTime(0, now);
  master.gain.linearRampToValueAtTime(AMBIENT_VOLUME, now + 0.25);
  master.gain.setValueAtTime(AMBIENT_VOLUME, now + seconds - 0.6);
  master.gain.linearRampToValueAtTime(0, now + seconds);
  const timer = setTimeout(stop, seconds * 1000 + 100);
  return () => {
    clearTimeout(timer);
    stop();
  };
}

export type FrequencyToneHandle = {
  update: (cfg: SoundConfig["frequencies"]) => void;
  stop: StopHandle;
};

/**
 * Starts a mono or binaural tone and returns a live handle. `update` retunes
 * oscillators in place (rebuilding the graph only on mono↔binaural switches),
 * which is what makes slider-drag previews glitch-free.
 */
export function startFrequencyTone(
  ctx: AudioContext,
  cfg: SoundConfig["frequencies"],
  volume = FREQ_VOLUME
): FrequencyToneHandle {
  if (ctx.state === "suspended") void ctx.resume();

  let mode = cfg.mode;
  let nodes: {
    left?: OscillatorNode;
    right?: OscillatorNode;
    mono?: OscillatorNode;
    gain: GainNode;
  };

  function build(c: SoundConfig["frequencies"]) {
    const gain = ctx.createGain();
    gain.gain.value = volume;
    gain.connect(ctx.destination);

    if (c.mode === "mono") {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = c.monoHz;
      osc.connect(gain);
      osc.start();
      return { mono: osc, gain };
    }
    const merger = ctx.createChannelMerger(2);
    const left = ctx.createOscillator();
    const right = ctx.createOscillator();
    const lg = ctx.createGain();
    const rg = ctx.createGain();
    left.type = "sine";
    right.type = "sine";
    left.frequency.value = c.leftHz;
    right.frequency.value = c.rightHz;
    lg.gain.value = 1;
    rg.gain.value = 1;
    left.connect(lg);
    right.connect(rg);
    lg.connect(merger, 0, 0);
    rg.connect(merger, 0, 1);
    merger.connect(gain);
    left.start();
    right.start();
    return { left, right, gain };
  }

  function teardown() {
    try {
      nodes.mono?.stop();
      nodes.left?.stop();
      nodes.right?.stop();
    } catch {
      /* already stopped */
    }
    try {
      nodes.gain.disconnect();
    } catch {
      /* */
    }
  }

  nodes = build(cfg);

  return {
    update(next) {
      if (next.mode !== mode) {
        teardown();
        mode = next.mode;
        nodes = build(next);
        return;
      }
      if (next.mode === "mono") {
        nodes.mono?.frequency.setTargetAtTime(next.monoHz, ctx.currentTime, 0.05);
      } else {
        nodes.left?.frequency.setTargetAtTime(next.leftHz, ctx.currentTime, 0.05);
        nodes.right?.frequency.setTargetAtTime(next.rightHz, ctx.currentTime, 0.05);
      }
    },
    stop: teardown,
  };
}

export type AudioEngine = {
  ctx: AudioContext;
  start: (config: SoundConfig) => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  strikeBell: () => void;
  updateFrequencies: (config: SoundConfig["frequencies"]) => void;
};

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  // Warm the bell samples so the first strike can use the recording, not synth.
  for (const t of Object.keys(BELL_SAMPLE_URLS) as BellType[]) preloadBellSample(ctx, t);
  let stops: StopHandle[] = [];
  let bellTimer: ReturnType<typeof setInterval> | null = null;
  let currentBellType: BellType = "small";
  let currentConfig: SoundConfig | null = null; // kept so resume() can re-arm bells
  let freqHandle: FrequencyToneHandle | null = null;

  function armBellInterval() {
    if (currentConfig?.bells.enabled && currentConfig.bells.intervalMin > 0) {
      const ms = currentConfig.bells.intervalMin * 60 * 1000;
      bellTimer = setInterval(() => playBell(ctx, currentBellType), ms);
    }
  }

  function clearFreq() {
    freqHandle?.stop();
    freqHandle = null;
  }

  return {
    ctx,
    start(config: SoundConfig) {
      this.stop();
      if (ctx.state === "suspended") void ctx.resume();

      currentBellType = config.bells.type;
      currentConfig = config;

      if (config.music.enabled && config.music.presetId) {
        stops.push(startAmbientNodes(ctx, config.music.presetId).stop);
      }

      if (config.frequencies.enabled) {
        freqHandle = startFrequencyTone(ctx, config.frequencies);
      }

      if (config.bells.enabled) {
        if (config.bells.strikeStart) {
          playBell(ctx, config.bells.type);
        }
        armBellInterval();
      }
    },
    stop() {
      if (bellTimer) {
        clearInterval(bellTimer);
        bellTimer = null;
      }
      stops.forEach((s) => s());
      stops = [];
      clearFreq();
      currentConfig = null;
    },
    // Pause freezes audio: suspend the context (silences drones/tones cleanly)
    // and stop scheduling bells. resume() picks the sound back up in place.
    pause() {
      if (bellTimer) {
        clearInterval(bellTimer);
        bellTimer = null;
      }
      void ctx.suspend();
    },
    resume() {
      void ctx.resume();
      armBellInterval();
    },
    strikeBell() {
      playBell(ctx, currentBellType);
    },
    updateFrequencies(cfg) {
      if (!cfg.enabled) {
        clearFreq();
        return;
      }
      if (!freqHandle) {
        freqHandle = startFrequencyTone(ctx, cfg);
        return;
      }
      freqHandle.update(cfg);
    },
  };
}

export function beatBandLabel(deltaHz: number): string {
  const d = Math.abs(deltaHz);
  if (d < 0.5) return "unison";
  if (d < 4) return "delta range";
  if (d < 8) return "theta range";
  if (d < 13) return "alpha range";
  if (d < 30) return "beta range";
  return "gamma range";
}

export type { AmbientRecipe };
