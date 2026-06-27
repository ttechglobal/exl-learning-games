"use client";

import { playSound } from "@/motion/sound/playSound";

/**
 * motion/payoffSequence.ts
 *
 * Choreography helper for the multi-beat success/failure moments extracted
 * from Build The Atom v2: success isn't one animation, it's a sequence
 * (state-flip -> flash/scale -> shockwave ring(s) -> delayed secondary
 * reward beat). This module owns the TIMING; the calling engine still owns
 * which CSS classes/elements actually animate, since that's necessarily
 * different per engine's visual design.
 */

export interface SuccessSequenceCallbacks {
  /** Fires immediately: flip to "stabilized" visual state, primary flash/scale, shockwave(s). */
  onPrimaryBeat: () => void;
  /** Fires after the secondary delay: e.g. an XP number popping up. */
  onSecondaryBeat?: () => void;
  /** Fires after the full sequence completes: e.g. navigate to the Reflection screen. */
  onSequenceComplete?: () => void;
}

const SECONDARY_BEAT_DELAY_MS = 350;
const FULL_SEQUENCE_DURATION_MS = 1500;

export function runSuccessSequence(callbacks: SuccessSequenceCallbacks): void {
  callbacks.onPrimaryBeat();
  playSound("success");

  if (callbacks.onSecondaryBeat) {
    setTimeout(() => {
      playSound("xp");
      callbacks.onSecondaryBeat?.();
    }, SECONDARY_BEAT_DELAY_MS);
  }

  if (callbacks.onSequenceComplete) {
    setTimeout(callbacks.onSequenceComplete, FULL_SEQUENCE_DURATION_MS);
  }
}

export interface FailureSequenceCallbacks {
  /** Fires immediately: show the System Warning card / feedback text. */
  onShowFeedback: () => void;
  /** Optional: trigger a CSS shake class on some element (whole screen, or a local element). */
  onShake?: () => void;
  onShakeEnd?: () => void;
}

const SHAKE_DURATION_MS = 420;

export function runFailureSequence(callbacks: FailureSequenceCallbacks): void {
  callbacks.onShowFeedback();
  playSound("fail");

  if (callbacks.onShake) {
    callbacks.onShake();
    if (callbacks.onShakeEnd) {
      setTimeout(callbacks.onShakeEnd, SHAKE_DURATION_MS);
    }
  }
}
