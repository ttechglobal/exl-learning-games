"use client";

/**
 * ChideraAvatar.tsx
 *
 * Ms. Chidera — the maths tutor character for the Stepwise Solver engine.
 * mood prop swaps the face expression only — no animation, just a static swap.
 *
 * explain   🙂  default — gentle smile, neutral brows
 * wrong     🤔  flat mouth, one raised brow — "think again"
 * insight   😮  open mouth — "key moment"
 * celebrate 🎉  big smile, raised brows — "well done!"
 */

type Mood = "explain" | "wrong" | "insight" | "celebrate";

export function ChideraAvatar({ size = 44, mood = "explain" }: { size?: number; mood?: Mood }) {

  // Brows
  const brows = {
    explain:   <>
      <path d="M14 14.5 Q16.2 13.5 18.5 14.5" fill="none" stroke="#0f0500" strokeWidth="1" />
      <path d="M22 14.5 Q24.2 13.5 26.5 14.5" fill="none" stroke="#0f0500" strokeWidth="1" />
    </>,
    wrong: <>
      {/* Left brow raised, right brow flat */}
      <path d="M14 13.5 Q16.2 12.2 18.5 13.5" fill="none" stroke="#0f0500" strokeWidth="1" />
      <path d="M22 15 Q24.2 15 26.5 15"        fill="none" stroke="#0f0500" strokeWidth="1" />
    </>,
    insight: <>
      {/* Both brows raised */}
      <path d="M14 13 Q16.2 11.8 18.5 13"  fill="none" stroke="#0f0500" strokeWidth="1" />
      <path d="M22 13 Q24.2 11.8 26.5 13"  fill="none" stroke="#0f0500" strokeWidth="1" />
    </>,
    celebrate: <>
      {/* Brows up and arched */}
      <path d="M14 13 Q16.2 11.5 18.5 13"  fill="none" stroke="#0f0500" strokeWidth="1.2" />
      <path d="M22 13 Q24.2 11.5 26.5 13"  fill="none" stroke="#0f0500" strokeWidth="1.2" />
    </>,
  };

  // Mouth
  const mouth = {
    explain:   <path d="M17.5 23 Q22 26.5 26.5 23" fill="none" stroke="#7a3520" strokeWidth="1.4" strokeLinecap="round" />,
    wrong:     <path d="M18 24 Q22 23 26 24"        fill="none" stroke="#7a3520" strokeWidth="1.4" strokeLinecap="round" />,
    insight:   <>
      <ellipse cx="22" cy="24.5" rx="3" ry="2.5" fill="#7a3520" />
      <ellipse cx="22" cy="24.8" rx="2.2" ry="1.8" fill="#3a0a00" />
    </>,
    celebrate: <>
      {/* Big open smile */}
      <path d="M16.5 22.5 Q22 28 27.5 22.5" fill="#7a3520" />
      <path d="M17.5 23 Q22 27 26.5 23"     fill="#3a0a00" />
    </>,
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Ms. Chidera"
    >
      <circle cx="22" cy="22" r="22" fill="#f5a623" />
      <path d="M8 44 Q10 30 22 29 Q34 30 36 44Z" fill="#2a5298" />
      <path d="M22 29 L17 33 L15 44" fill="none" stroke="#1a3a7a" strokeWidth="1.2" />
      <path d="M22 29 L27 33 L29 44" fill="none" stroke="#1a3a7a" strokeWidth="1.2" />
      <path d="M20 29 L22 32 L24 29" fill="white" />
      <rect x="9" y="30" width="8" height="10" rx="1.5" fill="#1a3a7a" />
      <rect x="10" y="30" width="6" height="10" rx="1" fill="#e8f0fe" />
      <line x1="11" y1="32" x2="15" y2="32" stroke="#9ab" strokeWidth="0.7" />
      <line x1="11" y1="34" x2="15" y2="34" stroke="#9ab" strokeWidth="0.7" />
      <line x1="11" y1="36" x2="13" y2="36" stroke="#9ab" strokeWidth="0.7" />
      <rect x="19.5" y="26" width="5" height="5" rx="2" fill="#b87045" />
      <ellipse cx="22" cy="17" rx="10" ry="11" fill="#b87045" />
      <ellipse cx="22" cy="9" rx="11" ry="8.5" fill="#1a0800" />
      <ellipse cx="12" cy="14" rx="3" ry="6" fill="#1a0800" />
      <ellipse cx="32" cy="14" rx="3" ry="6" fill="#1a0800" />
      <ellipse cx="22" cy="6" rx="8" ry="5" fill="#1a0800" />
      <ellipse cx="16" cy="8" rx="3" ry="1.5" fill="#2d0e00" opacity="0.5" />
      <ellipse cx="28" cy="7.5" rx="2.5" ry="1.2" fill="#2d0e00" opacity="0.4" />
      <ellipse cx="12" cy="18" rx="2" ry="2.5" fill="#a86035" />
      <ellipse cx="32" cy="18" rx="2" ry="2.5" fill="#a86035" />
      <rect x="13" y="15" width="6.5" height="4.5" rx="2.2" fill="none" stroke="#1a0800" strokeWidth="1.4" />
      <rect x="21" y="15" width="6.5" height="4.5" rx="2.2" fill="none" stroke="#1a0800" strokeWidth="1.4" />
      <line x1="19.5" y1="17.2" x2="21" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />
      <line x1="13" y1="17.2" x2="11" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />
      <line x1="27.5" y1="17.2" x2="29.5" y2="17.2" stroke="#1a0800" strokeWidth="1.4" />
      <ellipse cx="16.2" cy="17.2" rx="1.5" ry="1.6" fill="#0f0500" />
      <ellipse cx="24.2" cy="17.2" rx="1.5" ry="1.6" fill="#0f0500" />
      <circle cx="16.8" cy="16.6" r="0.5" fill="white" />
      <circle cx="24.8" cy="16.6" r="0.5" fill="white" />
      <ellipse cx="22" cy="20.5" rx="1.3" ry="0.7" fill="#9a5030" opacity="0.6" />
      {brows[mood]}
      {mouth[mood]}
      <path d="M32 31 Q36 25 34 19" fill="none" stroke="#b87045" strokeWidth="3.5" strokeLinecap="round" />
      <ellipse cx="33.5" cy="17.5" rx="1.2" ry="2.5" fill="#b87045" transform="rotate(-20 33.5 17.5)" />
    </svg>
  );
}