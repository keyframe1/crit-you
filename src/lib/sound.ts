"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Crit's chiptune sound engine.
//
// EVERYTHING here is synthesised in-house with the Web Audio API — there are NO
// audio assets, samples, or third-party libraries, and therefore nothing to
// attribute. Every blip, tick, arpeggio, fanfare and womp is built live from
// oscillators, gain envelopes and a WaveShaper bit-crusher at trigger time.
//
// The whole palette runs through ONE parametrized voice (`note`) driven by a die
// "tier" 0–7 (D4=0 … D∞=7). The tier is the single knob that evolves the sound
// from a primitive single-square blip (D4) to a rich, clean, FM-shimmered cosmic
// voice (D∞):
//   • voices    — tier 0 is one naked square; each tier layers in detuned /
//                 harmonic / sub / bell partials (square → pulse → +triangle →
//                 +saw → +shimmer → FM bell by D∞).
//   • pitch     — rises with tier.
//   • bit-crush — a WaveShaper amplitude quantizer, heaviest (fewest levels) at
//                 tier 0, lightening as the tier climbs, bypassed (clean) at D∞.
//   • envelope  — short and blippy at low tiers, longer and sparklier up high.
// Each trigger adds a little pitch/timing jitter so repeats never feel mechanical.
//
// Audio is unlocked lazily on the first user gesture (autoplay policy), gated on
// the sound toggle (default ON), and kept deliberately quiet and tasteful.
// ─────────────────────────────────────────────────────────────────────────────

import type { DieType } from "@/lib/dice";

// ── Tier ─────────────────────────────────────────────────────────────────────
// The one parameter that scales the whole engine. D4 is the crudest blip; D∞ the
// richest cosmic voice.
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
// via useSyncExternalStore without an SSR hydration mismatch. Default ON; the
// real value is read from localStorage on the first client read.
const SOUND_KEY = "crit:sound:v1";
let enabled = true;
let hydrated = false;
const soundListeners = new Set<() => void>();

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(SOUND_KEY);
    return raw === null ? true : raw === "1";
  } catch {
    return true;
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

// useSyncExternalStore snapshots. Server defaults to ON so the toggle renders the
// same on the server and the first client paint, then re-reads the real value.
export function getSoundSnapshot(): boolean {
  return isSoundEnabled();
}
export function getSoundServerSnapshot(): boolean {
  return true;
}

// ── Audio graph ──────────────────────────────────────────────────────────────
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  // Master bus: a low overall gain (quiet + tasteful) into a gentle compressor so
  // layered voices never clip even when many partials stack on a flourish.
  master = ctx.createGain();
  master.gain.value = 0.18;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16;
  comp.knee.value = 24;
  comp.ratio.value = 3;
  comp.attack.value = 0.003;
  comp.release.value = 0.2;
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

// Create + resume the context. Safe to call from any user-gesture handler; a
// no-op once running. Exported so click handlers can unlock audio synchronously.
export function primeAudio(): void {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
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

// ── Tier → timbre derivations (the "one parametrized generator") ─────────────
interface Layer {
  type: OscillatorType;
  detune: number; // cents
  gain: number; // relative, normalised below
  mult: number; // frequency multiplier (harmonic / sub-octave)
}

// The voice stack grows with tier: a naked square at 0, gaining detuned thickness
// (pulse), octave + harmonic shimmer, a reedy saw, a sub-octave, and bell partials
// toward the top. (The D∞ FM bell is added separately in `note`.)
function layersForTier(tier: number): Layer[] {
  const layers: Layer[] = [{ type: "square", detune: 0, gain: 1.0, mult: 1 }];
  if (tier >= 1) layers.push({ type: "square", detune: 8, gain: 0.5, mult: 1 }); // detune → pulse width
  if (tier >= 2) layers.push({ type: "triangle", detune: 0, gain: 0.35, mult: 2 }); // octave harmonic
  if (tier >= 3) layers.push({ type: "sawtooth", detune: -6, gain: 0.28, mult: 1 }); // reedy body
  if (tier >= 4) layers.push({ type: "triangle", detune: 5, gain: 0.24, mult: 3 }); // 3rd-harmonic shimmer
  if (tier >= 5) layers.push({ type: "square", detune: -10, gain: 0.22, mult: 0.5 }); // sub-octave warmth
  if (tier >= 6) layers.push({ type: "sine", detune: 0, gain: 0.3, mult: 4 }); // bell partial
  if (tier >= 7) layers.push({ type: "sine", detune: 3, gain: 0.22, mult: 6 }); // high cosmic partial
  return layers;
}

// Bit-crush depth: heaviest at tier 0 (~3 levels), lightening with tier. Tier 7
// (D∞) bypasses the shaper entirely for a clean voice (see `note`).
function crushStepsForTier(tier: number): number {
  return Math.round(3 + Math.pow(tier / 7, 2) * 60);
}

// Pitch rises with tier (semitones added to a sound's root).
function tierPitchShift(tier: number): number {
  return tier * 1.5;
}

// Envelope length grows with tier: blippy down low, more sustain/sparkle up high.
function tierSustain(tier: number): number {
  return 1 + tier * 0.18;
}

const A4 = 440;
// Frequency for a semitone offset from A4. All sounds are authored as semitone
// offsets so the tier pitch-shift and per-trigger jitter compose cleanly.
function semis(n: number): number {
  return A4 * Math.pow(2, n / 12);
}

// ── The one voice ────────────────────────────────────────────────────────────
interface NoteOpts {
  freq: number;
  start: number; // ctx time
  dur: number; // base note length, before the tier sustain scaling
  tier: number;
  peak: number; // peak gain (0..1) into the master bus
  slideTo?: number; // optional glide target (the bust womp)
  attack?: number;
}

function note(o: NoteOpts): void {
  const c = ctx;
  const out = master;
  if (!c || !out) return;

  const layers = layersForTier(o.tier);
  const sustain = tierSustain(o.tier);
  const dur = o.dur * sustain;
  const attack = o.attack ?? 0.004;
  const t = o.start;
  const end = t + dur;

  // Per-note gain hub = the amplitude envelope.
  const env = c.createGain();
  env.gain.value = 0;

  // Optional bit-crusher in the chain (tier 0–6); D∞ runs clean.
  if (o.tier < 7) {
    const shaper = c.createWaveShaper();
    shaper.curve = crushCurve(crushStepsForTier(o.tier));
    shaper.oversample = "none"; // keep the aliasing grit — part of the lo-fi feel
    env.connect(shaper);
    shaper.connect(out);
  } else {
    env.connect(out);
  }

  // Normalise the layer mix so loudness stays roughly constant across tiers —
  // higher tiers get RICHER, not LOUDER.
  const totalGain = layers.reduce((s, l) => s + l.gain, 0);
  const norm = 1 / totalGain;

  for (const layer of layers) {
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

  // D∞ FM bell shimmer: an inharmonic modulator detunes a sine carrier's pitch,
  // giving the top tier a clean, glassy bell on top of the oscillator stack.
  if (o.tier >= 7) {
    const mod = c.createOscillator();
    mod.type = "sine";
    mod.frequency.setValueAtTime(o.freq * 2.01, t); // inharmonic ratio → bell
    const modGain = c.createGain();
    modGain.gain.value = o.freq * 1.4; // FM index
    mod.connect(modGain);
    const carrier = c.createOscillator();
    carrier.type = "sine";
    carrier.frequency.setValueAtTime(o.freq * 1.5, t);
    modGain.connect(carrier.frequency);
    const cg = c.createGain();
    cg.gain.value = 0.16;
    carrier.connect(cg);
    cg.connect(env);
    mod.start(t);
    carrier.start(t);
    mod.stop(end + 0.05);
    carrier.stop(end + 0.05);
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

// A small symmetric jitter in semitones, for per-trigger variation.
function jitter(cents = 0.4): number {
  return (Math.random() - 0.5) * cents;
}

// ── The palette ──────────────────────────────────────────────────────────────
// All five required sounds plus a light "sparkle" for near-crits. Every one is
// tier-scaled through `note`; the clack is where the bit progression is felt most.

// CLACK — the roll. A short clatter of 2–3 rising blips (the dice leaving the
// hand). Lowest, crunchiest tiers feel the most lo-fi here.
export function playClack(tier: number): void {
  play((now) => {
    const root = 4 + tierPitchShift(tier);
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
      freq: semis(-6 + tierPitchShift(tier) + jitter()),
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
    const root = 14 + tierPitchShift(tier);
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
    const root = 3 + tierPitchShift(tier);
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
// ascending run capped by a held, ringing chord; extra high shimmer on the rich
// upper tiers so a D20/D30/D∞ fanfare genuinely outshines a humble D4's.
export function playFlourish(tier: number): void {
  play((now) => {
    const root = 3 + tierPitchShift(tier);
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
    // The richest tiers earn a glittering high tail.
    if (tier >= 5) {
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
    const root = 2 + tierPitchShift(tier);
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
