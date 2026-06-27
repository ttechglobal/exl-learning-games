"use client";

export type MascotPose = "idle" | "celebrate" | "encourage";

export interface MascotProps {
  pose: MascotPose;
  widthPx?: number;
  /** CSS animation class hook for callers wanting an entrance/bounce on pose change. */
  className?: string;
  style?: React.CSSProperties;
}

const POSE_FILES: Record<MascotPose, string> = {
  idle: "/mascot/mascot-idle.svg",
  celebrate: "/mascot/mascot-celebrate.svg",
  encourage: "/mascot/mascot-encourage.svg"
};

/**
 * motion/Mascot.tsx
 *
 * The platform's single recurring host character (per product direction —
 * one mascot reused across every game, rather than per-game character art,
 * to keep illustration cost bounded as the game catalog grows). Three poses
 * today: idle (entry/neutral), celebrate (success payoff), encourage
 * (gentle failure feedback — never punitive, per the "no punishment, only
 * guidance" rule).
 *
 * Plain <img> against a static SVG file, not inlined — keeps this component
 * trivial and lets the browser cache the asset across screens/games.
 */
export function Mascot({ pose, widthPx = 160, className, style }: MascotProps) {
  return (
    <img
      src={POSE_FILES[pose]}
      alt=""
      role="presentation"
      width={widthPx}
      height={widthPx * (440 / 240)}
      className={className}
      style={{ display: "block", ...style }}
    />
  );
}
