import type { Metadata } from "next";
import { ThemeProvider } from "@/components/ui/ThemeProvider";
import { PlayerNamePrompt } from "@/components/identity/PlayerNamePrompt";
import { OfflineQueueFlusher } from "@/components/identity/OfflineQueueFlusher";
import "@/motion/tokens.css";

// @vercel/analytics is an optional package — requires `npm install @vercel/analytics`
// and enabling Web Analytics in the Vercel dashboard. If the package isn't installed
// yet, this import will throw a "Cannot find module" error at build time, which
// manifests as "TypeError: Cannot read properties of undefined (reading 'call')"
// at runtime. The try/catch dynamic import below prevents that error from crashing
// the whole app while the package isn't yet installed.
let VercelAnalytics: React.ComponentType | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  VercelAnalytics = require("@vercel/analytics/next").Analytics;
} catch {
  // Package not installed — page views just won't be tracked until it is.
  // Run: npm install @vercel/analytics
}

export const metadata: Metadata = {
  title: "EXL Learning Games",
  description: "Learning games for WAEC/JAMB exam preparation"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
          <link
    rel="stylesheet"
    href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css"
    crossOrigin="anonymous"
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
          <OfflineQueueFlusher />
          {children}
        </ThemeProvider>
        {/* Vercel Analytics — tracks page views once @vercel/analytics is
            installed (npm install @vercel/analytics) and enabled in the Vercel
            dashboard. No-ops safely if the package isn't installed yet. */}
        {VercelAnalytics && <VercelAnalytics />}
      </body>
    </html>
  );
}