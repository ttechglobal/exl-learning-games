"use client";

import { useEffect, useState } from "react";
import { PERIODIC_TABLE_SLICE, CATEGORY_COLORS, getElementByAtomicNumber } from "@/motion/periodicTableData";
import styles from "@/motion/PeriodicTableReveal.module.css";

export interface PeriodicTableRevealProps {
  /** Atomic number of the element just successfully built — this cell lights up. */
  highlightAtomicNumber: number;
}

/**
 * motion/PeriodicTableReveal.tsx
 *
 * Renders a compact 18-element periodic table (periods 1-3) and lights up
 * the element the student just built, on the Reflection screen, after a
 * successful "Stabilize Atom." Reinforces *where this element lives* in the
 * broader table, not just "you got the composition right."
 *
 * Deliberately scoped to 18 elements (not all 118) — keeps the grid simple,
 * lightweight, and covers every element Build The Atom's current missions
 * use. If missions ever target a heavier element, extend
 * periodicTableData.ts rather than changing this component.
 */
export function PeriodicTableReveal({ highlightAtomicNumber }: PeriodicTableRevealProps) {
  const [lit, setLit] = useState(false);

  useEffect(() => {
    // Small delay so the reveal feels like a deliberate second beat after
    // arriving on the Reflection screen, not an instant flash on mount.
    const timer = setTimeout(() => setLit(true), 250);
    return () => clearTimeout(timer);
  }, [highlightAtomicNumber]);

  const targetElement = getElementByAtomicNumber(highlightAtomicNumber);
  const accentColor = targetElement ? CATEGORY_COLORS[targetElement.category] : "#00e5ff";

  // Build a full 18-column x 3-row grid, leaving empty cells where periods 1-2
  // have no element in groups 3-12 (standard periodic table shape).
  const rows = [1, 2, 3].map((period) =>
    Array.from({ length: 18 }, (_, i) => {
      const group = i + 1;
      return PERIODIC_TABLE_SLICE.find((e) => e.period === period && e.group === group) ?? null;
    })
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.eyebrow}>Where it lives on the Periodic Table</div>
      <div className={styles.grid}>
        {rows.flatMap((row, rowIndex) =>
          row.map((element, colIndex) => {
            if (!element) {
              return <div key={`${rowIndex}-${colIndex}`} className={`${styles.cell} ${styles.cellEmpty}`} />;
            }
            const isTarget = element.atomicNumber === highlightAtomicNumber;
            const cellColor = CATEGORY_COLORS[element.category];
            return (
              <div
                key={element.atomicNumber}
                className={[styles.cell, isTarget ? styles.cellTarget : "", isTarget && lit ? styles.lit : ""]
                  .filter(Boolean)
                  .join(" ")}
                style={{ "--cell-color": cellColor } as React.CSSProperties}
              >
                {isTarget && (
                  <span className={`${styles.calloutLabel} ${lit ? styles.lit : ""}`} style={{ "--cell-color": cellColor } as React.CSSProperties}>
                    {element.name}
                  </span>
                )}
                {element.symbol}
              </div>
            );
          })
        )}
      </div>
      {targetElement && (
        <div className={styles.legend}>
          Atomic number <b style={{ color: accentColor }}>{targetElement.atomicNumber}</b> · Group {targetElement.group}, Period{" "}
          {targetElement.period}
        </div>
      )}
    </div>
  );
}
