/**
 * motion/touchTarget.ts
 *
 * Mobile touch-feel helpers extracted from Build The Atom v2: pointer events
 * (not mouse-only, since hover doesn't fire on touch), and a recommended
 * minimum hit-area so visually small controls stay easy to tap on low-end
 * Android screens.
 */

/** WCAG/mobile-platform guidance generally lands around 44-48px minimum; we use 44 as the floor. */
export const MIN_TOUCH_TARGET_PX = 44;

/**
 * Given a control's intended VISUAL size, returns the hit-area size to use
 * for its actual tappable wrapper. If the visual is already big enough, the
 * hit area just equals the visual size (no invisible padding needed).
 */
export function resolveHitAreaSize(visualSizePx: number): number {
  return Math.max(visualSizePx, MIN_TOUCH_TARGET_PX);
}

export interface PressHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
}

/**
 * Returns the three pointer handlers a generator/action button needs for
 * correct press-state feedback on both touch and mouse. `onPress` fires on
 * pointerup (the actual action); `onPressStart`/`onPressEnd` drive visual
 * press-state (scale/glow) only.
 */
export function createPressHandlers(
  onPressStart: () => void,
  onPressEnd: () => void,
  onPress: () => void
): PressHandlers {
  return {
    onPointerDown: onPressStart,
    onPointerUp: () => {
      onPress();
      onPressEnd();
    },
    onPointerLeave: onPressEnd
  };
}
