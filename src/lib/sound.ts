"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Crit's chiptune sound engine.
//
// EVERYTHING here is synthesised in-house with the Web Audio API — there are NO
// audio assets, samples, impulse-response files, or third-party libraries, and
// therefore nothing to attribute. Every blip, tick, arpeggio, fanfare and womp —
// and every echo and reverb tail — is built live from oscillators, noise buffers,
// gain envelopes, a WaveShaper bit-crusher, biquad filters, a feedback delay, and
// a procedurally-generated convolution impulse, at trigger time.
//
// The whole palette runs through ONE parametrized voice (`note`) driven by a die
// "tier" 0–7, which maps the eight dice across FOUR recognizable console eras
// (two dice per era; the generation is meant to be audible). Escalation is by
// BIT-FIDELITY, **not pitch and not loudness** — the base register is constant
// across dice (only a small per-trigger jitter varies it), and the master
// normalization + compressor keep higher eras RICHER, not louder:
//
//   8-bit  (D4, D6)   — PSG square/pulse + a noise transient, 1–2 voices, HEAVY
//                       bit-crush, an aggressive/dull low-pass, no effects.
//   16-bit (D8, D10)  — FM + detuned voices, MODERATE crush, a short slap echo,
//                       a brighter low-pass.
//   32-bit (D12, D20) — richer layered timbres, LIGHT crush, procedural reverb
//                       (a synthetic convolution impulse — no IR file), fuller.
//   64-bit (D30, D∞)  — lush multi-voice + bell/shimmer partials, NO crush, clean
//                       reverb, brightest. D∞ is the cleanest, richest, most
//                       ethereal of all.
//
// (A true sample-rate-decimation AudioWorklet was considered for extra low-tier
// grit — see PART 2 of the brief — but heavy crush + an aggressive low-pass + the
// noise transient already read convincingly 8-bit, so the worklet is intentionally
// skipped to avoid an async static-asset load in the gesture-driven audio path.)
//
// Audio is unlocked lazily on the first user gesture (autoplay policy) and gated
// on the sound toggle, which DEFAULTS TO OFF — the user opts in.
// ─────────────────────────────────────────────────────────────────────────────

import type { DieType } from "@/lib/dice";

// ── Tier ─────────────────────────────────────────────────────────────────────
// The one parameter that scales the whole engine — the die's place across the
// four console eras (see the era table below). D4 is the crudest 8-bit blip; D∞
// the cleanest 64-bit voice.
const TIER: Record<DieType, number> = {
  d4: 0,
  d6: 1,
  d8: 2,
  d10: 3,
  d12: 4,
  d20: 5,
  d30: 6,
  dinf: 7,
};

export function tierForDie(die: DieType): number {
  return TIER[die] ?? 5;
}

// ── Sound-enabled store ──────────────────────────────────────────────────────
// A tiny external store (mirrors the daily store pattern) so React can subscribe
// via useSyncExternalStore without an SSR hydration mismatch. DEFAULT OFF — sound
// is opt-in; the real value is read from localStorage on the first client read.
const SOUND_KEY = "crit:sound:v1";
let enabled = false;
let hydrated = false;
const soundListeners = new Set<() => void>();

function readEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.localStorage.getItem(SOUND_KEY);
    // Unset → OFF (opt-in). Only an explicit stored "1" enables sound.
    return raw === "1";
  } catch {
    return false;
  }
}

function ensureHydrated(): void {
  if (hydrated || typeof window === "undefined") return;
  enabled = readEnabled();
  hydrated = true;
}

export function isSoundEnabled(): boolean {
  ensureHydrated();
  return enabled;
}

export function setSoundEnabled(value: boolean): void {
  enabled = value;
  hydrated = true;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(SOUND_KEY, value ? "1" : "0");
    } catch {
      // Private mode / storage full: the toggle still works this session.
    }
  }
  // Flipping sound ON is itself a user gesture — a perfect moment to unlock audio.
  if (value) primeAudio();
  soundListeners.forEach((l) => l());
}

export function toggleSound(): boolean {
  const next = !isSoundEnabled();
  setSoundEnabled(next);
  return next;
}

export function subscribeSound(cb: () => void): () => void {
  soundListeners.add(cb);
  return () => {
    soundListeners.delete(cb);
  };
}

// useSyncExternalStore snapshots. Server defaults to OFF so the toggle renders the
// muted speaker on the server and the first client paint, then re-reads the real
// (opt-in) value.
export function getSoundSnapshot(): boolean {
  return isSoundEnabled();
}
export function getSoundServerSnapshot(): boolean {
  return false;
}

// ── Audio graph ──────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
// Era effect send buses (built once, idle when nothing sends). 16-bit cues send
// to the slap echo; 32-/64-bit cues send to the procedural reverb.
let echoBus: GainNode | null = null;
let reverbBus: GainNode | null = null;

// A procedurally-generated convolution impulse: exponentially-decaying stereo
// noise. This is the reverb's "room" — synthesised, never loaded from a file.
function makeImpulse(
  c: AudioContext,
  seconds: number,
  decay: number
): AudioBuffer {
  const rate = c.sampleRate;
  const len = Math.max(1, Math.floor(rate * seconds));
  const buf = c.createBuffer(2, len, rate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  const c = new AC();
  ctx = c;
  // Master bus: a low overall gain (quiet + tasteful) into a gentle compressor so
  // layered voices + effect tails never clip even when many partials stack.
  const m = c.createGain();
  m.gain.value = 0.18;
  master = m;
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  m.connect(comp);
  comp.connect(c.destination);

  // 16-bit slap echo: a single short delay tap with light feedback.
  const echoIn = c.createGain();
  const echoDelay = c.createDelay(0.5);
  echoDelay.delayTime.value = 0.11;
  const echoFb = c.createGain();
  echoFb.gain.value = 0.25;
  const echoWet = c.createGain();
  echoWet.gain.value = 0.9;
  echoIn.connect(echoDelay);
  echoDelay.connect(echoFb);
  echoFb.connect(echoDelay);
  echoDelay.connect(echoWet);
  echoWet.connect(m);
  echoBus = echoIn;

  // 32-/64-bit procedural reverb: a convolver fed by the synthetic impulse.
  const revIn = c.createGain();
  const conv = c.createConvolver();
  conv.buffer = makeImpulse(c, 1.8, 3.2);
  const revWet = c.createGain();
  revWet.gain.value = 0.9;
  revIn.connect(conv);
  conv.connect(revWet);
  revWet.connect(m);
  reverbBus = revIn;

  return c;
}

// Create + resume the context. Safe to call from any user-gesture handler; a
// no-op once running. Exported so click handlers can unlock audio synchronously.
export function primeAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
}

// Cached single-channel white-noise buffer for the 8-bit PSG noise transient.
let noiseBuf: AudioBuffer | null = null;
function getNoiseBuffer(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.4);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  noiseBuf = buf;
  return buf;
}

// ── Bit-crush (WaveShaper amplitude quantizer) ───────────────────────────────
// A step curve quantizes the signal's amplitude to `steps` levels — the classic
// lo-fi crunch. Fewer steps = heavier crush. Curves are cached per step count.
const crushCache = new Map<number, Float32Array<ArrayBuffer>>();
function crushCurve(steps: number): Float32Array<ArrayBuffer> {
  const cached = crushCache.get(steps);
  if (cached) return cached;
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.round(x * steps) / steps;
  }
  crushCache.set(steps, curve);
  return curve;
}

// ── Tier → era (the "one parametrized generator" — now a BIT-ERA axis) ───────
type EraName = "8-bit" | "16-bit" | "32-bit" | "64-bit";

interface Layer {
  type: OscillatorType;
  detune: number; // cents (timbral thickness, NOT a pitch shift)
  gain: number; // relative, normalised in `note`
  mult: number; // frequency multiplier (harmonic / sub-octave)
}

interface FMVoice {
  carrierMult: number;
  modMult: number;
  index: number; // FM index (× fundamental → modulator gain)
  gain: number;
}

// Each era's character, with two dice per era as anchors. The "anchor" (lower) die
// of each pair takes the base values; the "upper" die is refined a touch within
// the band (extra layer, relaxed crush, opened filter, more send/sustain) so the
// gradation is audible but the ERA still reads. D∞ is the upper 64-bit voice — the
// cleanest, brightest, most ethereal of all.
interface EraBase {
  era: EraName;
  baseLayers: Layer[];
  upperLayers: Layer[]; // added for the refined (upper) die of the pair
  noiseAmt: number; // PSG noise transient level (anchor); 0 = none
  fm: FMVoice | null;
  crushSteps: number | null; // anchor amplitude-quantize levels; null = clean
  cutoff: number; // low-pass cutoff Hz (era brightness), anchor
  q: number;
  effect: "none" | "echo" | "reverb";
  send: number; // wet send amount (anchor)
  sustain: number; // envelope-length multiplier (anchor)
}

const ERAS: Record<EraName, EraBase> = {
  // 8-BIT — PSG. One naked square (the upper die adds a detuned pulse voice), a
  // crunchy noise transient, brutal crush, a dull aliased low-pass, no effects.
  "8-bit": {
    era: "8-bit",
    baseLayers: [{ type: "square", detune: 0, gain: 1.0, mult: 1 }],
    upperLayers: [{ type: "square", detune: 10, gain: 0.5, mult: 1 }], // pulse-ish 2nd voice
    noiseAmt: 0.22,
    fm: null,
    crushSteps: 2,
    cutoff: 2200,
    q: 0.8,
    effect: "none",
    send: 0,
    sustain: 0.85,
  },
  // 16-BIT — FM + detuned voices, moderate crush, a short slap echo, brighter.
  "16-bit": {
    era: "16-bit",
    baseLayers: [
      { type: "square", detune: 0, gain: 1.0, mult: 1 },
      { type: "square", detune: 8, gain: 0.5, mult: 1 }, // detuned twin
    ],
    upperLayers: [{ type: "triangle", detune: 0, gain: 0.35, mult: 2 }], // octave shimmer
    noiseAmt: 0,
    fm: { carrierMult: 1, modMult: 2, index: 1.1, gain: 0.4 },
    crushSteps: 9,
    cutoff: 4800,
    q: 0.9,
    effect: "echo",
    send: 0.18,
    sustain: 1.0,
  },
  // 32-BIT — richer layered timbres, light crush, procedural reverb, fuller.
  "32-bit": {
    era: "32-bit",
    baseLayers: [
      { type: "square", detune: 0, gain: 1.0, mult: 1 },
      { type: "square", detune: 8, gain: 0.5, mult: 1 },
      { type: "triangle", detune: 0, gain: 0.35, mult: 2 }, // octave
      { type: "sawtooth", detune: -6, gain: 0.28, mult: 1 }, // reedy body
    ],
    upperLayers: [{ type: "triangle", detune: 5, gain: 0.22, mult: 3 }], // 3rd-harmonic
    noiseAmt: 0,
    fm: { carrierMult: 1, modMult: 3, index: 0.6, gain: 0.18 },
    crushSteps: 36,
    cutoff: 9000,
    q: 0.9,
    effect: "reverb",
    send: 0.16,
    sustain: 1.15,
  },
  // 64-BIT — lush multi-voice + bell/shimmer partials, NO crush, clean reverb,
  // brightest. The upper die (D∞) adds a high cosmic partial and opens furthest.
  "64-bit": {
    era: "64-bit",
    baseLayers: [
      { type: "square", detune: 0, gain: 1.0, mult: 1 },
      { type: "square", detune: 8, gain: 0.5, mult: 1 },
      { type: "triangle", detune: 0, gain: 0.35, mult: 2 },
      { type: "sawtooth", detune: -6, gain: 0.26, mult: 1 },
      { type: "square", detune: -10, gain: 0.2, mult: 0.5 }, // sub-octave warmth
      { type: "sine", detune: 0, gain: 0.3, mult: 4 }, // bell partial
    ],
    upperLayers: [{ type: "sine", detune: 3, gain: 0.22, mult: 6 }], // high cosmic partial
    noiseAmt: 0,
    fm: { carrierMult: 1.5, modMult: 2.01, index: 1.4, gain: 0.16 }, // ethereal bell
    crushSteps: null,
    cutoff: 17000,
    q: 0.7,
    effect: "reverb",
    send: 0.24,
    sustain: 1.3,
  },
};

const ERA_ORDER: EraName[] = ["8-bit", "16-bit", "32-bit", "64-bit"];

interface ResolvedEra {
  era: EraName;
  layers: Layer[];
  noiseAmt: number;
  fm: FMVoice | null;
  crushSteps: number | null;
  cutoff: number;
  q: number;
  effect: "none" | "echo" | "reverb";
  send: number;
  sustain: number;
}

// Resolve a tier to its era config. Two tiers share each era; the odd (upper) tier
// is refined within the band: an extra layer, a relaxed crush, a more-open filter,
// and a touch more send + ring.
function eraFor(tier: number): ResolvedEra {
  const idx = Math.min(3, Math.max(0, Math.floor(tier / 2)));
  const upper = tier % 2 === 1;
  const base = ERAS[ERA_ORDER[idx]];
  return {
    era: base.era,
    layers: upper ? [...base.baseLayers, ...base.upperLayers] : base.baseLayers,
    noiseAmt: base.noiseAmt * (upper ? 0.6 : 1),
    fm: base.fm,
    crushSteps:
      base.crushSteps == null
        ? null
        : Math.round(base.crushSteps * (upper ? 1.7 : 1)),
    cutoff: Math.min(20000, base.cutoff * (upper ? 1.35 : 1)),
    q: base.q,
    effect: base.effect,
    send: base.send * (upper ? 1.18 : 1),
    sustain: base.sustain * (upper ? 1.1 : 1),
  };
}

const A4 = 440;
// Frequency for a semitone offset from A4. Each cue has its OWN constant register
// (a land tick sits low, a sparkle high); the tier no longer shifts it — only the
// per-trigger jitter varies pitch, for naturalness.
function semis(n: number): number {
  return A4 * Math.pow(2, n / 12);
}

// ── The one voice ────────────────────────────────────────────────────────────
interface NoteOpts {
  freq: number;
  start: number; // ctx time
  dur: number; // base note length, before the era sustain scaling
  tier: number;
  peak: number; // peak gain (0..1) into the master bus
  slideTo?: number; // optional glide target (the bust womp)
  attack?: number;
}

function note(o: NoteOpts): void {
  const c = ctx;
  const out = master;
  if (!c || !out) return;

  const era = eraFor(o.tier);
  const dur = o.dur * era.sustain;
  const attack = o.attack ?? 0.004;
  const t = o.start;
  const end = t + dur;

  // Per-note amplitude envelope hub.
  const env = c.createGain();
  env.gain.value = 0;

  // env → [bit-crush] → low-pass → master (dry) + a tap → era effect bus (wet).
  // The crush quantizes amplitude (lo-fi grit); the low-pass sets era brightness.
  let chainTail: AudioNode = env;
  if (era.crushSteps != null) {
    const shaper = c.createWaveShaper();
    shaper.curve = crushCurve(era.crushSteps);
    shaper.oversample = "none"; // keep the aliasing grit — part of the lo-fi feel
    chainTail.connect(shaper);
    chainTail = shaper;
  }
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = era.cutoff;
  lp.Q.value = era.q;
  chainTail.connect(lp);
  lp.connect(out); // dry
  if (era.effect !== "none" && era.send > 0) {
    const bus = era.effect === "echo" ? echoBus : reverbBus;
    if (bus) {
      const sendGain = c.createGain();
      sendGain.gain.value = era.send;
      lp.connect(sendGain);
      sendGain.connect(bus);
    }
  }

  // Normalise the oscillator mix so loudness stays roughly constant across eras —
  // higher eras get RICHER, not LOUDER.
  const totalGain = era.layers.reduce((s, l) => s + l.gain, 0) || 1;
  const norm = 1 / totalGain;

  for (const layer of era.layers) {
    const osc = c.createOscillator();
    osc.type = layer.type;
    osc.frequency.setValueAtTime(o.freq * layer.mult, t);
    osc.detune.setValueAtTime(layer.detune, t);
    if (o.slideTo != null) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, o.slideTo * layer.mult),
        end
      );
    }
    const g = c.createGain();
    g.gain.value = layer.gain * norm;
    osc.connect(g);
    g.connect(env);
    osc.start(t);
    osc.stop(end + 0.05);
  }

  // FM voice (16-bit body / 64-bit bell): a modulator detunes a carrier's pitch.
  if (era.fm) {
    const { carrierMult, modMult, index, gain } = era.fm;
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(o.freq * modMult, t);
    const modGain = c.createGain();
    modGain.gain.value = o.freq * index;
    mod.connect(modGain);
    const carrier = c.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(o.freq * carrierMult, t);
    modGain.connect(carrier.frequency);
    const cg = c.createGain();
    cg.gain.value = gain;
    carrier.connect(cg);
    cg.connect(env);
    mod.start(t);
    carrier.start(t);
    mod.stop(end + 0.05);
    carrier.stop(end + 0.05);
  }

  // PSG noise transient (8-bit): a short crunchy chiff at the attack, fed through
  // the same crush + filter so it shares the lo-fi character.
  if (era.noiseAmt > 0) {
    const src = c.createBufferSource();
    src.buffer = getNoiseBuffer(c);
    src.loop = true;
    const ng = c.createGain();
    ng.gain.setValueAtTime(0, t);
    ng.gain.linearRampToValueAtTime(era.noiseAmt, t + 0.002);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
    src.connect(ng);
    ng.connect(env);
    src.start(t);
    src.stop(t + 0.06);
  }

  // Fast attack, exponential decay to silence (exp ramps can't reach 0).
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(o.peak, t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, end);
}

// Gate + unlock, then run a scheduling callback on the audio clock.
function play(schedule: (now: number) => void): void {
  if (!isSoundEnabled()) return;
  const c = getCtx();
  if (!c) return;
  if (c.state === "suspended") c.resume().catch(() => {});
  schedule(c.currentTime);
}

// A small symmetric jitter in semitones, for per-trigger variation (the only
// thing that moves pitch now — the tier does not).
function jitter(amount = 0.4): number {
  return (Math.random() - 0.5) * amount;
}

// ── The palette ──────────────────────────────────────────────────────────────
// All five required sounds plus a light "sparkle" for near-crits. Each cue has a
// CONSTANT base register; the active die's tier only changes the ERA character
// (synthesis, crush, filter, voices, effects) through `note`.

// CLACK — the roll. A short clatter of 2–3 blips (the dice leaving the hand) —
// where the bit-era texture is felt most: a crushed PSG rattle at 8-bit, a
// reverbed shimmer at 64-bit.
export function playClack(tier: number): void {
  play((now) => {
    const root = 4;
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) {
      const step = i * (1.5 + Math.random());
      note({
        freq: semis(root + step + jitter(0.6)),
        start: now + i * (0.045 + Math.random() * 0.02),
        dur: 0.05,
        tier,
        peak: 0.5,
        attack: 0.002,
      });
    }
  });
}

// LAND — the settle. One very short, low tick: the die clicking onto its face.
export function playLand(tier: number): void {
  play((now) => {
    note({
      freq: semis(-6 + jitter()),
      start: now,
      dur: 0.045,
      tier,
      peak: 0.42,
      attack: 0.001,
    });
  });
}

// SPARKLE — a near-crit. Two bright, high blips: a light "ooh, so close" beat.
export function playSparkle(tier: number): void {
  play((now) => {
    const root = 14;
    [0, 7].forEach((s, i) => {
      note({
        freq: semis(root + s + jitter(0.3)),
        start: now + i * 0.05,
        dur: 0.1,
        tier,
        peak: 0.3,
      });
    });
  });
}

// BANK — the clean cash-out. A rising major arpeggio (root–3rd–5th–octave).
export function playBank(tier: number): void {
  play((now) => {
    const root = 3;
    [0, 4, 7, 12].forEach((s, i) => {
      note({
        freq: semis(root + s + jitter(0.3)),
        start: now + i * 0.075,
        dur: 0.12,
        tier,
        peak: 0.42,
      });
    });
  });
}

// FLOURISH — the triumph (nat-max / perfect run / streak milestone). A longer
// ascending run capped by a held, ringing chord; the richer eras' fuller voices +
// reverb make a D20/D30/D∞ fanfare genuinely outshine a humble D4's crushed one.
export function playFlourish(tier: number): void {
  play((now) => {
    const root = 3;
    const run = [0, 4, 7, 12, 16, 19];
    run.forEach((s, i) => {
      note({
        freq: semis(root + s + jitter(0.25)),
        start: now + i * 0.07,
        dur: 0.16,
        tier,
        peak: 0.4,
      });
    });
    // Held ringing chord at the top of the run.
    const holdAt = now + run.length * 0.07;
    [12, 16, 19, 24].forEach((s) => {
      note({
        freq: semis(root + s),
        start: holdAt,
        dur: 0.5,
        tier,
        peak: 0.3,
      });
    });
    // The richer eras (32-/64-bit) earn a glittering high tail.
    if (tier >= 4) {
      [28, 31].forEach((s, i) => {
        note({
          freq: semis(root + s),
          start: holdAt + 0.1 + i * 0.06,
          dur: 0.4,
          tier,
          peak: 0.22,
        });
      });
    }
  });
}

// BUST — the natural 1. A subtle, descending detuned tone: two voices sliding
// down an octave, one slightly sour, for the deflating womp.
export function playBust(tier: number): void {
  play((now) => {
    const root = 2;
    note({
      freq: semis(root),
      start: now,
      dur: 0.5,
      tier,
      peak: 0.3,
      slideTo: semis(root - 12),
      attack: 0.01,
    });
    note({
      freq: semis(root + 0.4),
      start: now,
      dur: 0.5,
      tier,
      peak: 0.22,
      slideTo: semis(root - 11.6),
      attack: 0.01,
    });
  });
}

// ── Convenience: the per-roll landing sound ──────────────────────────────────
// One place both modes call when a die lands, so the audio hierarchy is identical
// in free play and the daily: a nat-1 womps, a nat-max flourishes, a near-crit
// gets a tick + sparkle, and an ordinary roll just ticks. (Daily bank outcomes —
// the bigger flourish for a perfect run / streak milestone — are handled by the
// caller, where that context lives.)
export function playRollResult(tier: number, value: number, max: number): void {
  if (value <= 1) {
    playBust(tier);
    return;
  }
  if (value >= max) {
    playFlourish(tier);
    return;
  }
  playLand(tier);
  if (value >= Math.ceil(max * 0.9)) playSparkle(tier);
}
