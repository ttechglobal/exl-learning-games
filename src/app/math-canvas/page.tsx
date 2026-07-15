// src/app/maths-canvas/page.tsx
// EXL Maths Canvas — live prototype endpoint
// Route: /maths-canvas
// No auth, no DB — standalone for device testing

import type { Metadata } from "next";
import { MathsCanvas } from "./MathCanvas";

export const metadata: Metadata = {
  title: "EXL Maths Canvas · Prototype",
  description: "Interactive maths working environment — free-form, line by line.",
};

export default function MathsCanvasPage() {
  return <MathsCanvas />;
}