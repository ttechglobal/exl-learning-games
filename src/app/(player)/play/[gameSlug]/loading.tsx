// FILE: src/app/(player)/play/[gameSlug]/loading.tsx
// Shown instantly while PlayPage fetches game + missions from DB.

export default function PlayLoading() {
  return (
    <div style={{
      minHeight: "100dvh",
      background: "radial-gradient(ellipse 120% 80% at 50% -10%, var(--eg-bg-mid), var(--eg-bg-deep))",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 16,
      padding: 20,
    }}>
      {/* Game card skeleton */}
      <div style={{
        width: "100%", maxWidth: 420,
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 20,
        padding: "32px 24px",
        display: "flex", flexDirection: "column",
        alignItems: "center", gap: 18,
      }}>
        {/* Icon placeholder */}
        <div style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "rgba(255,255,255,0.08)",
          animation: "pulse 1.6s ease-in-out infinite",
        }} />
        {/* Title */}
        <div style={{
          width: 200, height: 22, borderRadius: 6,
          background: "rgba(255,255,255,0.08)",
          animation: "pulse 1.6s ease-in-out infinite",
          animationDelay: "0.1s",
        }} />
        {/* Subtitle */}
        <div style={{
          width: 140, height: 14, borderRadius: 4,
          background: "rgba(255,255,255,0.05)",
          animation: "pulse 1.6s ease-in-out infinite",
          animationDelay: "0.15s",
        }} />
        {/* Button */}
        <div style={{
          width: "100%", height: 48, borderRadius: 50,
          background: "rgba(255,255,255,0.07)",
          animation: "pulse 1.6s ease-in-out infinite",
          animationDelay: "0.2s",
        }} />
      </div>

      {/* Loading text */}
      <p style={{
        color: "rgba(255,255,255,0.3)",
        fontSize: 13,
        fontFamily: "var(--eg-font-display, 'Space Grotesk', sans-serif)",
        fontWeight: 600,
        letterSpacing: "0.05em",
        animation: "pulse 1.6s ease-in-out infinite",
      }}>
        Loading game…
      </p>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.9; }
        }
      `}</style>
    </div>
  );
}