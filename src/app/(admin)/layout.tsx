import "@/motion/tokens.css";

/**
 * app/(admin)/layout.tsx
 *
 * Admin route group layout. The root app/layout.tsx already wraps everything
 * (ThemeProvider, IdentityBootstrap, OfflineQueueFlusher, Vercel Analytics)
 * so this just adds admin-specific chrome: a dark background and a simple
 * top nav.
 *
 * The TypeError: Cannot read properties of undefined (reading 'call') on
 * the admin pages was caused by @vercel/analytics not yet being installed
 * when the root layout was first loaded. Running `npm install @vercel/analytics`
 * fixes it. This layout file also ensures the admin route group has its own
 * layout entry point, which improves Next.js module bundling isolation.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1017",
        color: "#e2e8f0",
        fontFamily: "'Inter', system-ui, sans-serif"
      }}
    >
      <nav
        style={{
          padding: "12px 24px",
          borderBottom: "1px solid #1e2535",
          display: "flex",
          alignItems: "center",
          gap: 24,
          fontSize: "0.85rem"
        }}
      >
        <span style={{ fontWeight: 700, fontSize: "1rem", color: "#fff" }}>EXL Admin</span>
        <a href="/admin" style={{ color: "#94a3b8", textDecoration: "none" }}>Dashboard</a>
        <a href="/admin/games" style={{ color: "#94a3b8", textDecoration: "none" }}>Games</a>
        <a href="/" style={{ color: "#94a3b8", textDecoration: "none", marginLeft: "auto" }}>← Back to App</a>
      </nav>
      {children}
    </div>
  );
}
