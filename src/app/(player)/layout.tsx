/**
 * Player layout — responsive.
 *
 * Mobile:  full-screen, no cap.
 * Desktop: centred content with horizontal padding, max comfortable width.
 *          Each engine handles its own internal two-column layout.
 *          The old 480px phone-column constraint is removed.
 */
export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return (
    <main style={{
      minHeight: "100vh",
      background: "#08101e",
    }}>
      {children}
    </main>
  );
}