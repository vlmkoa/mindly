/**
 * Synthesized meditation audio via the Web Audio API.
 * No audio files — ambient beds, bells, and mono/binaural beats are generated live.
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
    leftHz: 200,
    rightHz: 206,
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

function bellPartials(type: BellType): { freq: number; gain: number; decay: number }[] {
  switch (type) {
    case "large":
      return [
        { freq: 220, gain: 0.45, decay: 3.2 },
        { freq: 440, gain: 0.22, decay: 2.4 },
        { freq: 660, gain: 0.12, decay: 1.8 },
        { freq: 880, gain: 0.06, decay: 1.2 },
      ];
    case "wood":
      return [
        { freq: 480, gain: 0.5, decay: 0.35 },
        { freq: 960, gain: 0.25, decay: 0.2 },
        { freq: 1440, gain: 0.1, decay: 0.12 },
      ];
    case "small":
    default:
      return [
        { freq: 528, gain: 0.4, decay: 1.8 },
        { freq: 792, gain: 0.2, decay: 1.2 },
        { freq: 1056, gain: 0.1, decay: 0.9 },
      ];
  }
}

export function playBell(ctx: AudioContext, type: BellType, when = ctx.currentTime): void {
  if (ctx.state === "suspended") void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  for (const p of bellPartials(type)) {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type === "wood" ? "triangle" : "sine";
    osc.frequency.value = p.freq;
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(p.gain, when + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, when + p.decay);
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
  strikeBell: () => void;
  updateFrequencies: (config: SoundConfig["frequencies"]) => void;
};

export function createAudioEngine(): AudioEngine {
  const ctx = new AudioContext();
  let stops: StopHandle[] = [];
  let bellTimer: ReturnType<typeof setInterval> | null = null;
  let currentBellType: BellType = "small";
  let freqHandle: FrequencyToneHandle | null = null;

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
        if (config.bells.intervalMin > 0) {
          const ms = config.bells.intervalMin * 60 * 1000;
          bellTimer = setInterval(() => {
            playBell(ctx, currentBellType);
          }, ms);
        }
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
