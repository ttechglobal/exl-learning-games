export default function PlayerLayout({ children }: { children: React.ReactNode }) {
  return <main style={{ minHeight: "100vh", position: "relative" }}>{children}</main>;
}
