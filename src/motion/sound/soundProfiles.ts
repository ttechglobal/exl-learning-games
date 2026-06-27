/**
 * motion/sound/soundProfiles.ts
 *
 * Per-cue tone definitions used by the placeholder synthesized sound hook
 * (playSound.ts). When real licensed/recorded audio assets are sourced,
 * this file becomes an asset manifest (cue name -> file path) instead of
 * oscillator parameters — call sites in engines don't change either way.
 */

export type SoundCue = "particleAdd" | "particleRemove" | "submit" | "success" | "fail" | "xp";

export interface SynthSoundProfile {
  freq: number;
  duration: number;
  type: OscillatorType;
  gain: number;
  /** If set, frequency ramps from `freq` to this value over `duration`. */
  sweepTo?: number;
}

export const SOUND_PROFILES: Record<SoundCue, SynthSoundProfile> = {
  particleAdd: { freq: 520, duration: 0.06, type: "sine", gain: 0.05 },
  particleRemove: { freq: 300, duration: 0.05, type: "sine", gain: 0.04 },
  submit: { freq: 400, duration: 0.08, type: "triangle", gain: 0.05 },
  success: { freq: 660, duration: 0.35, type: "sine", gain: 0.07, sweepTo: 990 },
  fail: { freq: 180, duration: 0.22, type: "sawtooth", gain: 0.05, sweepTo: 110 },
  xp: { freq: 880, duration: 0.18, type: "sine", gain: 0.05, sweepTo: 1320 }
};
