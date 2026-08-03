// FILE: src/app/(player)/worlds/loading.tsx
// Shown instantly while WorldsPage fetches games from DB.
// Next.js streams this to the browser before the server component finishes.

export default function WorldsLoading() {
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse 120% 80% at 50% -10%, var(--eg-bg-mid), var(--eg-bg-deep))",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      padding: "48px 20px",
      gap: 20,
    }}>
      {/* Header skeleton */}
      <div style={{
        width: 180, height: 28, borderRadius: 8,
        background: "rgba(255,255,255,0.07)",
        animation: "pulse 1.6s ease-in-out infinite",
      }} />

      {/* Subject group skeletons */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: "100%", maxWidth: 480,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16, padding: 16,
          display: "flex", flexDirection: "column", gap: 12,
          animationDelay: `${i * 0.1}s`,
        }}>
          {/* Subject label */}
          <div style={{
            width: 100, height: 14, borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
            animation: "pulse 1.6s ease-in-out infinite",
          }} />
          {/* Game cards */}
          {[0, 1].map(j => (
            <div key={j} style={{
              height: 72, borderRadius: 12,
              background: "rgba(255,255,255,0.05)",
              animation: "pulse 1.6s ease-in-out infinite",
              animationDelay: `${(i * 2 + j) * 0.08}s`,
            }} />
          ))}
        </div>
      ))}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}