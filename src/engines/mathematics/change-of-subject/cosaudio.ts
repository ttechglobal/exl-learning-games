/**
 * cosAudio.ts — Change of Subject Formula · Audio Engine
 *
 * Completely synthesised via Web Audio API. Zero external files.
 *
 * MUSIC DESIGN: Upbeat chiptune-inspired track. Fast tempo (140 BPM),
 * driving bass line, bright arpeggios, punchy percussion. Feels like a
 * classic game soundtrack — energetic enough to motivate but not so
 * intense it breaks concentration.
 *
 * STOP BEHAVIOUR: cosAudio.stopMusic() fades the music out over 0.3s
 * then fully disconnects nodes. Call this on component unmount.
 *
 * SOUND EFFECTS:
 *   correct()      — bright rising chime (reward)
 *   wrong()        — soft low thud (non-harsh)
 *   place()        — quiet click (tile lifted)
 *   drop()         — soft tap (tile landed)
 *   stepDone()     — rising two-note (step solved)
 *   missionDone()  — triumphant 4-note arpeggio
 *   tick()         — faint high tick (every 10s)
 *   timerWarn()    — urgent pulse (last 8s)
 *   startMusic()   — begin the looping track
 *   stopMusic()    — fade out and stop (call on unmount)
 *   toggleMusic()  — mute/unmute, returns new muted state
 *   isMuted()      — current mute state
 */

// ── Singleton AudioContext ────────────────────────────────────────────────────

let _ctx: AudioContext | null = null;
let _master: GainNode | null = null;
let _musicBus: GainNode | null = null;
let _sfxBus: GainNode | null = null;

// Music scheduler state
let _scheduleTimer: ReturnType<typeof setTimeout> | null = null;
let _musicStartTime = 0;
let _muted = false;
let _musicRunning = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!_ctx) {
    try {
      _ctx = new (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      _master   = _ctx.createGain(); _master.gain.value   = 1.0;
      _musicBus = _ctx.createGain(); _musicBus.gain.value = 0.18; // music level
      _sfxBus   = _ctx.createGain(); _sfxBus.gain.value   = 1.0;
      _musicBus.connect(_master);
      _sfxBus.connect(_master);
      _master.connect(_ctx.destination);
    } catch { return null; }
  }
  if (_ctx.state === "suspended") _ctx.resume();
  return _ctx;
}

// ── Primitive builders ─────────────────────────────────────────────────────

function osc(
  ctx: AudioContext,
  freq: number,
  type: OscillatorType,
  start: number,
  duration: number,
  gainPeak: number,
  bus: GainNode,
  attackSec = 0.01,
  decaySec?: number,
) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const decay = decaySec ?? duration - attackSec;
  g.gain.setValueAtTime(0, start);
  g.gain.linearRampToValueAtTime(gainPeak, start + attackSec);
  g.gain.exponentialRampToValueAtTime(0.0001, start + attackSec + decay);
  o.connect(g); g.connect(bus);
  o.start(start);
  o.stop(start + attackSec + decay + 0.01);
}

function noise(ctx: AudioContext, start: number, dur: number, gain: number, cutoff: number, bus: GainNode) {
  const len = Math.ceil(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filt = ctx.createBiquadFilter();
  filt.type = "lowpass";
  filt.frequency.value = cutoff;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filt); filt.connect(g); g.connect(bus);
  src.start(start); src.stop(start + dur);
}

// ── Music: 140 BPM upbeat chiptune ──────────────────────────────────────────
//
// One bar = 60/140 * 4 ≈ 1.714 s. We schedule 4 bars at a time (≈6.86 s),
// then reschedule 1 bar before the end to keep it seamless forever.
//
// STRUCTURE (4 bars, looping):
//   Bass:      driving eighth-note root pattern (square wave, low octave)
//   Chords:    bright arpeggiated triads (sawtooth, mid octave)
//   Lead:      melodic eighth-note hook (square, high octave)
//   Kick:      punchy noise burst on beats 1 and 3
//   Hi-hat:    light noise on every eighth note
//
// Key: D major  (D3=146.8Hz, F#3=185Hz, A3=220Hz, B3=246.9Hz, E3=164.8Hz)
// Tempo: 140 BPM → beat = 0.4286s, eighth = 0.2143s

const BPM    = 140;
const BEAT   = 60 / BPM;          // 0.4286 s
const EIGHTH = BEAT / 2;          // 0.2143 s
const BAR    = BEAT * 4;          // 1.7143 s
const BARS   = 4;                 // schedule this many bars at once
const LOOP   = BAR * BARS;        // total loop length ≈ 6.857 s

// Note frequencies (Hz) — D major scale
const D3 = 146.83; const Fs3 = 185.00; const A3 = 220.00;
const B3 = 246.94; const D4 = 293.66; const E4 = 329.63;
const Fs4 = 369.99; const G4 = 392.00; const A4 = 440.00;
const B4 = 493.88; const D5 = 587.33; const E5 = 659.25; const Fs5 = 739.99;

// Bass line: 16 eighth-note steps (= 2 bars repeated twice)
const E3 = 164.83;
const BASS_LINE = [D3, D3, A3, D3, B3, D3, A3, D3, D3, D3, G4/2, D3, E3, D3, A3, D3];
const BASS_LINE_2 = [D3, D3, A3, D3, Fs3, D3, A3, D3, B3, A3, G4/2, Fs3, E3, D3, A3, D3];

// Lead melody: 8 steps per bar (playful, memorable hook)
const LEAD: Array<number | null> = [
  D5, null, Fs5, null, E5, D5, null, B4,       // bar 1
  D5, E5, Fs5, null, A4, null, B4, null,       // bar 2
  D5, null, Fs5, E5, D5, null, B4, A4,         // bar 3
  B4, D5, E5, null, Fs5, E5, D5, null,         // bar 4
];

// Chord arp: bright triads cycling D-F#-A / B-D-F# / G-B-D / A-C#-E
const ARP_SETS = [
  [D4, Fs4, A4],
  [B3, D4, Fs4],
  [G4, B4, D5],
  [D4, E4, A4],   // D4 = A4/1.5 ≈ D4 in D major
];

function scheduleMusicBlock(ctx: AudioContext, bus: GainNode, startT: number) {
  // ── Kick (noise burst on beats 1 & 3 of each bar) ──────────────────────
  for (let bar = 0; bar < BARS; bar++) {
    const b = startT + bar * BAR;
    // Beat 1
    noise(ctx, b,          0.06, 0.28, 180, bus);
    osc(ctx, 55, "sine",   b,    0.12, 0.22, bus, 0.004, 0.11);
    // Beat 3
    noise(ctx, b + BEAT*2, 0.06, 0.22, 180, bus);
    osc(ctx, 55, "sine",   b + BEAT*2, 0.10, 0.18, bus, 0.004, 0.09);
  }

  // ── Hi-hat (every eighth note, quiet) ──────────────────────────────────
  for (let step = 0; step < BARS * 8; step++) {
    const t = startT + step * EIGHTH;
    noise(ctx, t, 0.035, 0.06, 8000, bus);
  }

  // ── Bass line ───────────────────────────────────────────────────────────
  for (let step = 0; step < BARS * 8; step++) {
    const t = startT + step * EIGHTH;
    const line = step < 16 ? BASS_LINE : BASS_LINE_2;
    const freq = line[step % 16];
    if (freq) osc(ctx, freq, "square", t, EIGHTH * 0.85, 0.14, bus, 0.005, EIGHTH * 0.72);
  }

  // ── Chord arpeggio ──────────────────────────────────────────────────────
  for (let bar = 0; bar < BARS; bar++) {
    const arpSet = ARP_SETS[bar % ARP_SETS.length];
    for (let step = 0; step < 8; step++) {
      const t = startT + bar * BAR + step * EIGHTH;
      const freq = arpSet[step % 3];
      osc(ctx, freq, "sawtooth", t, EIGHTH * 0.55, 0.045, bus, 0.008, EIGHTH * 0.45);
    }
  }

  // ── Lead melody ─────────────────────────────────────────────────────────
  for (let step = 0; step < BARS * 8; step++) {
    const freq = LEAD[step % (BARS * 8)];
    if (!freq) continue;
    const t = startT + step * EIGHTH;
    osc(ctx, freq, "square", t, EIGHTH * 0.7, 0.07, bus, 0.006, EIGHTH * 0.6);
    // Thin octave shadow
    osc(ctx, freq * 2, "square", t, EIGHTH * 0.4, 0.018, bus, 0.006, EIGHTH * 0.35);
  }
}

function scheduleLoop() {
  const ctx = getCtx();
  if (!ctx || !_musicBus || !_musicRunning) return;

  const now = ctx.currentTime;
  const next = _musicStartTime + LOOP;

  // Schedule 1 bar ahead so there's always audio buffered
  if (next - now < BAR + 0.1) {
    scheduleMusicBlock(ctx, _musicBus, next);
    _musicStartTime = next;
  }

  // Check again in half a bar
  _scheduleTimer = setTimeout(scheduleLoop, (BEAT * 2) * 1000);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function startMusic() {
  if (_musicRunning) return;
  const ctx = getCtx();
  if (!ctx || !_musicBus) return;
  _musicRunning = true;

  // Fade in
  if (_musicBus) {
    _musicBus.gain.cancelScheduledValues(ctx.currentTime);
    _musicBus.gain.setValueAtTime(0, ctx.currentTime);
    _musicBus.gain.linearRampToValueAtTime(_muted ? 0 : 0.18, ctx.currentTime + 0.5);
  }

  _musicStartTime = ctx.currentTime + 0.05;
  scheduleMusicBlock(ctx, _musicBus, _musicStartTime);
  scheduleLoop();
}

export function stopMusic() {
  _musicRunning = false;
  if (_scheduleTimer !== null) { clearTimeout(_scheduleTimer); _scheduleTimer = null; }

  const ctx = getCtx();
  if (!ctx || !_musicBus) return;

  // Smooth fade out
  _musicBus.gain.cancelScheduledValues(ctx.currentTime);
  _musicBus.gain.setValueAtTime(_musicBus.gain.value, ctx.currentTime);
  _musicBus.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3);
}

export function isMuted(): boolean { return _muted; }

export function toggleMusic(): boolean {
  _muted = !_muted;
  const ctx = getCtx();
  if (ctx && _musicBus) {
    _musicBus.gain.cancelScheduledValues(ctx.currentTime);
    _musicBus.gain.setValueAtTime(_musicBus.gain.value, ctx.currentTime);
    _musicBus.gain.linearRampToValueAtTime(_muted ? 0 : 0.18, ctx.currentTime + 0.15);
  }
  return _muted;
}

// ── Sound effects ─────────────────────────────────────────────────────────────

export function correct() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  const t = ctx.currentTime;
  osc(ctx, 659.25, "sine", t,        0.35, 0.3,  _sfxBus, 0.012);
  osc(ctx, 880,    "sine", t + 0.07, 0.4,  0.25, _sfxBus, 0.012);
  osc(ctx, 1174.7, "sine", t + 0.14, 0.3,  0.18, _sfxBus, 0.010);
}

export function wrong() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  const t = ctx.currentTime;
  noise(ctx, t, 0.1, 0.18, 300, _sfxBus);
  osc(ctx, 185, "sine", t, 0.15, 0.2, _sfxBus, 0.006);
}

export function place() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  osc(ctx, 1047, "sine", ctx.currentTime, 0.08, 0.12, _sfxBus, 0.004);
}

export function drop() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  osc(ctx, 523, "triangle", ctx.currentTime, 0.1, 0.14, _sfxBus, 0.006);
}

export function stepDone() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  const t = ctx.currentTime;
  osc(ctx, 784,    "sine", t,        0.35, 0.28, _sfxBus, 0.010);
  osc(ctx, 1046.5, "sine", t + 0.08, 0.4,  0.24, _sfxBus, 0.010);
}

export function missionDone() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  const t = ctx.currentTime;
  const notes = [523.25, 659.25, 784, 1046.5];
  notes.forEach((freq, i) => {
    osc(ctx, freq, "sine", t + i * 0.13, 0.55 + i * 0.08, 0.28 - i * 0.02, _sfxBus!, 0.012);
  });
  osc(ctx, 261.63, "sine", t + 0.52, 0.8, 0.18, _sfxBus, 0.020);
}

export function tick() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  osc(ctx, 1200, "sine", ctx.currentTime, 0.06, 0.06, _sfxBus, 0.003);
}

export function timerWarn() {
  const ctx = getCtx(); if (!ctx || !_sfxBus) return;
  osc(ctx, 880, "square", ctx.currentTime, 0.1, 0.08, _sfxBus, 0.004);
}

const cosAudio = {
  correct, wrong, place, drop, stepDone, missionDone,
  tick, timerWarn, startMusic, stopMusic, isMuted, toggleMusic,
};
export default cosAudio;