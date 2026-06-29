import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { PlayerNamePrompt } from "@/components/identity/PlayerNamePrompt";
import "@/motion/tokens.css";

export const metadata: Metadata = {
  title: "EXL Learning Games",
  description: "Learning games for WAEC/JAMB exam preparation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "radial-gradient(ellipse 120% 80% at 50% -10%, var(--eg-bg-mid), var(--eg-bg-deep))",
          color: "var(--eg-text-bright)",
          fontFamily: "var(--eg-font-body)"
        }}
      >
        <ThemeProvider>
          <PlayerNamePrompt />
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}