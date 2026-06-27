"use client";

import { SOUND_PROFILES, type SoundCue } from "@/motion/sound/soundProfiles";

/**
 * motion/sound/playSound.ts
 *
 * The single stable call site every engine uses for sound cues. Today this
 * fires a tiny synthesized Web Audio tone per cue — a timing reference, not
 * a final sound design — so cue placement/timing can be validated before
 * real audio assets exist. Swapping in real assets later means rewriting
 * the inside of `playSound()` only; no engine call site changes.
 */

let soundEnabled = true;
let audioCtx: AudioContext | null = null;

function ensureAudioCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

export function setSoundEnabled(enabled: boolean): void {
  soundEnabled = enabled;
  if (enabled) ensureAudioCtx();
}

export function isSoundEnabled(): boolean {
  return soundEnabled;
}

export function playSound(cue: SoundCue): void {
  if (!soundEnabled) return;
  const ctx = ensureAudioCtx();
  if (!ctx) return;

  const profile = SOUND_PROFILES[cue];
  if (!profile) return;

  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = profile.type;
  osc.frequency.setValueAtTime(profile.freq, ctx.currentTime);
  if (profile.sweepTo) {
    osc.frequency.exponentialRampToValueAtTime(profile.sweepTo, ctx.currentTime + profile.duration);
  }
  gainNode.gain.setValueAtTime(profile.gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + profile.duration);
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + profile.duration);
}

/** Call on a user gesture (e.g. "Start Mission" tap) — browsers require user interaction before audio can play. */
export function primeAudioOnUserGesture(): void {
  ensureAudioCtx();
}
