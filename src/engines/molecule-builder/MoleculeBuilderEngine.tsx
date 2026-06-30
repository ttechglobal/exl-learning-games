"use client";

import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import type {
  MoleculeBuilderConfig,
  MoleculeBuilderOutcome,
  BondOrder,
  AtomDef,
  TargetBond,
  Slot
} from "@/engines/molecule-builder/moleculeBuilder.config";
import {
  bondCountForSlot,
  wouldOverfill,
  checkStructure,
  buildFeedback,
  atomDefBySymbol,
  type PlacedBond
} from "@/engines/molecule-builder/moleculeBuilder.logic";
import { runSuccessSequence, runFailureSequence } from "@/motion/payoffSequence";
import { playSound, primeAudioOnUserGesture } from "@/motion/sound/playSound";
import { Mascot } from "@/motion/Mascot";
import type { EngineRuntimeProps } from "@/engines/engine-types";
import { GameplayShell, type GameplayStat } from "@/components/gameplay/GameplayShell";
import { GAME_ENVIRONMENT_IMAGES } from "@/lib/content/gameEnvironments";
import styles from "@/engines/molecule-builder/MoleculeBuilderEngine.module.css";

/**
 * engines/molecule-builder/MoleculeBuilderEngine.tsx
 *
 * REDESIGNED per direct feedback that the original tap-to-arm bonding
 * interaction wasn't clear or easy to understand — players were
 * spending effort figuring out the GAME's controls rather than the
 * CHEMISTRY, which is backwards for a teaching tool. Per the explicit
 * brief: "make it like a simple drag and drop to fit in... we can have
 * the lines that connect, then the user can connect it."
 *
 * THE NEW MECHANIC — dot-to-dot, not tap-to-arm:
 *   1. Every bond the finished molecule needs (mission.payload.
 *      targetBonds) is drawn on the board as a DASHED line between its
 *      two slot positions THE INSTANT the mission loads — the player
 *      sees the full skeleton shape upfront, not just empty dots with
 *      no indication of how they connect.
 *   2. The player's only action is dragging atoms from the dock onto
 *      open slot circles (unchanged from before — this part was never
 *      the confusing half).
 *   3. The moment BOTH ends of a dashed line have the correct atom
 *      placed, that bond forms AUTOMATICALLY — no tap-to-arm, no
 *      separate "connect" gesture. The line itself visibly changes from
 *      dashed to solid the instant this happens, which is the core
 *      "this connection is done" feedback.
 *   4. wouldOverfill is still checked at the exact moment of
 *      auto-bonding — if completing a line would exceed an atom's real
 *      capacity, the bond is REJECTED (the same red-flash teaching
 *      moment as before), and the line stays dashed/open. This is what
 *      makes carbon's 4-bond limit still something the player runs
 *      into physically, not just reads about — that part of the
 *      original design is preserved exactly, only the TRIGGER for the
 *      check moved from "second tap" to "second atom placed."
 *
 * BOND ORDER (single/double/triple) — derived per-mission, not a
 * global game setting: if every one of THIS mission's real
 * targetBonds is "single" (true for every Easy/Medium mission), no
 * order decision exists at all — every auto-formed bond is simply
 * single, full stop, no UI for it. Only when a mission's real
 * targetBonds include a non-single order (Hard tier: ethene, ethyne)
 * does a bond-order choice appear, and even then it's LOCALIZED to the
 * one dashed line that needs it — tapping that specific line (not a
 * global selector affecting "whatever bonds next") opens a small
 * picker for just that connection. This is deliberate: a player
 * shouldn't need to learn the controls before the chemistry can start
 * teaching them, so Easy/Medium have literally nothing to figure out
 * beyond "drag atoms onto the dots" — the bond-order CHOICE, the
 * actual harder concept, is introduced in complete isolation once
 * dot-to-dot placement is already second nature.
 *
 * Built directly on GameplayShell from the start (the bond-match /
 * tile-match pattern), not the not-yet-migrated particle-assembly
 * pattern — see engine-types.ts's EngineRuntimeProps.menu comment for
 * why particle-assembly is NOT the template to copy here.
 */
export function MoleculeBuilderEngine({
  config,
  onComplete,
  isPaused,
  menu,
  gameTitle
}: EngineRuntimeProps<MoleculeBuilderConfig, MoleculeBuilderOutcome>) {
  const { shared, mission } = config;
  const payload = mission.payload;
  const roster = shared.atomRoster;
  const dockAtoms = useMemo(
    () => payload.dockSymbols.map((s) => atomDefBySymbol(roster, s)).filter((a): a is AtomDef => Boolean(a)),
    [payload.dockSymbols, roster]
  );

  // Whether THIS mission has any bond-order decision at all — derived
  // from its real targetBonds, not a separate setting that could drift
  // out of sync with the actual content. See file header.
  const needsOrderChoice = useMemo(() => payload.targetBonds.some((b) => b.order !== "single"), [payload.targetBonds]);

  /**
   * Real pointer-tracked drag state — REPLACES a previous, broken
   * hybrid of native HTML5 drag-and-drop (`draggable` + `onDragStart`)
   * layered on top of a manual pointer-event fallback that referenced a
   * `data-drop-symbol` attribute NOTHING ever actually set (a genuine
   * dead-code mismatch, not just a style preference). Per direct
   * feedback ("I drag, drop, then I have to click before it shows —
   * that is not a good user experience"): traced this to native HTML5
   * DnD requiring a `dragover`+`drop` handler pair on the TARGET to
   * accept a drop at all, which `.emptySlot` never had — so a real drag
   * gesture silently failed every time, and only a SEPARATE plain
   * click afterward (which happened to still have the broken
   * mechanism's leftover armed state) ever actually placed an atom.
   *
   * Fixed by adopting the same pattern BondMatchEngine.tsx already uses
   * successfully (see its onPointerMove/onPointerUp + window-level
   * listener pattern) — no native DnD anywhere, pure pointer tracking:
   * pointerdown on a dock capsule arms a drag, pointermove updates a
   * visual ghost following the pointer, pointerup hit-tests the
   * release position directly against each slot's real DOM rect (via
   * slotRefs below) and places the atom there if it lands inside one.
   * One continuous gesture, no second click required, because there's
   * no longer a competing mechanism for the browser to silently fail at
   * underneath the working one.
   */
  const [dragState, setDragState] = useState<{ symbol: string; x: number; y: number } | null>(null);
  const slotRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const buildSurfaceRef = useRef<HTMLDivElement>(null);

  const [placedAtoms, setPlacedAtoms] = useState<Record<string, string>>({});
  const [bonds, setBonds] = useState<PlacedBond[]>([]);
  // Per-LINE chosen order, keyed by "slotA|slotB" (both directions
  // normalized to the order targetBonds lists them in) — only relevant
  // when needsOrderChoice is true. A line with no entry here yet and no
  // formed bond is still waiting on a choice.
  const [chosenOrders, setChosenOrders] = useState<Record<string, BondOrder>>({});
  const [openOrderPickerFor, setOpenOrderPickerFor] = useState<string | null>(null);
  const [rejectingSlot, setRejectingSlot] = useState<string | null>(null);
  const [shaking, setShaking] = useState(false);
  const [feedback, setFeedback] = useState<{ visible: boolean; text: string; entering: boolean }>({
    visible: false,
    text: "",
    entering: false
  });
  const [stabilized, setStabilized] = useState(false);
  const [xpPop, setXpPop] = useState<{ visible: boolean; amount: number }>({ visible: false, amount: 0 });
  const [mascotPose, setMascotPose] = useState<"idle" | "celebrate" | "encourage" | null>(null);

  const attemptsRef = useRef(0);
  const startedAtRef = useRef(Date.now());

  const accentColor = "var(--eg-subject-chemistry)";

  function lineKey(slotA: string, slotB: string): string {
    return [slotA, slotB].sort().join("|");
  }

  /** Removes an atom AND every bond touching it — clearing a slot clears
   *  its connections too, since a bond to nothing isn't meaningful. The
   *  line reverts to dashed/open automatically (it's derived from
   *  `bonds`, not separately tracked), ready to auto-form again once
   *  both ends are refilled correctly. */
  const handleClearSlot = useCallback(
    (slotId: string) => {
      if (isPaused) return;
      setPlacedAtoms((prev) => {
        const next = { ...prev };
        delete next[slotId];
        return next;
      });
      setBonds((prev) => prev.filter((b) => b.slotA !== slotId && b.slotB !== slotId));
      playSound("particleRemove");
    },
    [isPaused]
  );

  /** Tries to auto-form every target bond touching this slot, now that
   *  it (or its partner) just got an atom. Called right after EITHER
   *  end of a target bond changes — placing an atom can complete a
   *  bond, and so can picking an order for a Hard-tier line whose atoms
   *  were already both placed and waiting on a choice. Pure "try every
   *  candidate, form whichever are actually ready" pass rather than
   *  tracking which specific line triggered it, since a single atom
   *  placement can simultaneously complete more than one line at once
   *  (e.g. the shared carbon in isobutane's branch point). */
  const tryAutoFormBonds = useCallback(
    (currentAtoms: Record<string, string>, currentBonds: PlacedBond[], currentChosenOrders: Record<string, BondOrder>) => {
      let working = currentBonds;
      let anyRejected: string | null = null;

      for (const target of payload.targetBonds) {
        const already = working.some(
          (b) => (b.slotA === target.slotA && b.slotB === target.slotB) || (b.slotA === target.slotB && b.slotB === target.slotA)
        );
        if (already) continue;

        const hasA = Boolean(currentAtoms[target.slotA]);
        const hasB = Boolean(currentAtoms[target.slotB]);
        if (!hasA || !hasB) continue; // this line isn't ready yet — still missing an atom on one end

        // Easy/Medium: every targetBond is "single", so there's nothing
        // to wait on. Hard: only attempt the bond once the player has
        // actually chosen an order for THIS specific line — until then,
        // both ends being filled just means the line is ready FOR a
        // choice, not that it auto-forms with a guessed order.
        const order: BondOrder | undefined = target.order === "single" ? "single" : currentChosenOrders[lineKey(target.slotA, target.slotB)];
        if (!order) continue;

        const candidate = { slotA: target.slotA, slotB: target.slotB, order };
        if (wouldOverfill(candidate, currentAtoms, working, roster)) {
          // Same teaching moment as before, just triggered by "both
          // ends now filled" instead of a second tap — carbon (or any
          // atom) flashes red and the bond does NOT form; the line
          // stays dashed/open, ready to try again once the player
          // swaps out whichever atom is overfilled.
          anyRejected = target.slotA;
          continue;
        }

        working = [...working, candidate];
      }

      if (working !== currentBonds) setBonds(working);
      if (anyRejected) {
        setRejectingSlot(anyRejected);
        playSound("fail");
        setShaking(true);
        setTimeout(() => setShaking(false), 420);
        setTimeout(() => setRejectingSlot(null), 420);
      }
      return working;
    },
    [payload.targetBonds, roster]
  );

  /**
   * WRONG-ATOM DROP FEEDBACK — fixes a confirmed silent-failure bug:
   * dropping an atom on a slot that doesn't accept it used to just
   * `return` with no visible or audible response at all, leaving the
   * player to guess why nothing happened. Every sibling engine already
   * has an equivalent moment (BondMatchEngine's rejectBond — shake +
   * fail sound + mascot "encourage" + a hint toast; TileMatchEngine's
   * wrong-tap red flash) — this brings molecule-builder up to the same
   * standard rather than inventing a new pattern. Reuses the EXACT
   * mechanism already built for the overfill case just below
   * (rejectingSlot + shaking + "fail" sound), since a wrong-symbol drop
   * and an overfill rejection are the same player-facing moment: "that
   * didn't work, here's why" — they shouldn't look or feel different
   * from each other.
   */
  const handleWrongSymbolDrop = useCallback(
    (symbol: string, slot: Slot) => {
      setRejectingSlot(slot.id);
      playSound("fail");
      setShaking(true);
      setTimeout(() => setShaking(false), 420);
      setTimeout(() => setRejectingSlot(null), 420);

      const wrongDef = atomDefBySymbol(roster, symbol);
      const acceptedNames = slot.acceptsSymbols
        .map((s) => atomDefBySymbol(roster, s)?.name ?? s)
        .join(" or ");
      // Reuses the SAME feedback card handleSubmit's failure path shows
      // (see the feedback.visible render below) — that card already
      // carries its own inline "encourage" mascot, so this deliberately
      // does NOT also trigger the separate floating mascotPose popup;
      // showing both at once would put two mascots on screen for one
      // moment.
      setFeedback({
        visible: true,
        text: `${wrongDef?.name ?? symbol} doesn't go there — that spot needs ${acceptedNames}.`,
        entering: true
      });
    },
    [roster]
  );

  const handleDockDrop = useCallback(
    (symbol: string, slotId: string) => {
      if (isPaused) return;
      const slot = payload.slots.find((s) => s.id === slotId);
      if (!slot) return;
      if (placedAtoms[slotId]) return; // slot already occupied — clear it first
      if (!slot.acceptsSymbols.includes(symbol)) {
        handleWrongSymbolDrop(symbol, slot);
        return;
      }

      const nextAtoms = { ...placedAtoms, [slotId]: symbol };
      setPlacedAtoms(nextAtoms);
      playSound("particleAdd");
      // Try auto-forming right away — this single placement might
      // complete one or more dashed lines immediately.
      tryAutoFormBonds(nextAtoms, bonds, chosenOrders);
    },
    [isPaused, payload.slots, placedAtoms, bonds, chosenOrders, tryAutoFormBonds, handleWrongSymbolDrop]
  );

  /** Finds which (if any) empty slot the given client-coordinate point
   *  is currently over, by checking each slot's real DOM rect — direct
   *  geometric hit-testing, the same family of approach
   *  BondMatchEngine.tsx uses (distance-to-nearest-atom there; here,
   *  point-inside-rect, since slots are fixed cells rather than
   *  free-floating atoms). Only considers EMPTY slots as valid targets,
   *  same as the drop logic always required. */
  const findSlotAtPoint = useCallback(
    (clientX: number, clientY: number): string | null => {
      for (const slot of payload.slots) {
        if (placedAtoms[slot.id]) continue; // occupied slots aren't valid drop targets
        const el = slotRefs.current[slot.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom) {
          return slot.id;
        }
      }
      return null;
    },
    [payload.slots, placedAtoms]
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      setDragState((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : prev));
    },
    []
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      setDragState((prev) => {
        if (prev) {
          const slotId = findSlotAtPoint(e.clientX, e.clientY);
          if (slotId) handleDockDrop(prev.symbol, slotId);
        }
        return null;
      });
    },
    [findSlotAtPoint, handleDockDrop]
  );

  // Window-level listeners only while an actual drag is in progress —
  // same lifecycle pattern as BondMatchEngine.tsx's own
  // pointermove/pointerup effect, registered/cleaned up by dragState
  // existing or not, rather than always-on listeners that would have
  // to self-filter on every move.
  useEffect(() => {
    if (!dragState) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragState, handlePointerMove, handlePointerUp]);

  const startDragFromDock = useCallback(
    (e: React.PointerEvent, symbol: string) => {
      if (isPaused) return;
      e.preventDefault();
      primeAudioOnUserGesture();
      setDragState({ symbol, x: e.clientX, y: e.clientY });
    },
    [isPaused]
  );

  /** Hard-tier only: tapping a dashed line that both ends are already
   *  filled for, but has no chosen order yet, opens a small inline
   *  picker for just that line. Tapping a line that's already solid
   *  (bond formed) or still missing an atom on either end does
   *  nothing — there's nothing to choose yet, or there's nothing left
   *  to choose. */
  const handleLineTap = useCallback(
    (target: TargetBond) => {
      if (isPaused || target.order === "single") return;
      const key = lineKey(target.slotA, target.slotB);
      const alreadyFormed = bonds.some(
        (b) => (b.slotA === target.slotA && b.slotB === target.slotB) || (b.slotA === target.slotB && b.slotB === target.slotA)
      );
      if (alreadyFormed) return;
      const hasA = Boolean(placedAtoms[target.slotA]);
      const hasB = Boolean(placedAtoms[target.slotB]);
      if (!hasA || !hasB) return; // nothing to choose until both ends are filled
      setOpenOrderPickerFor(key);
    },
    [isPaused, bonds, placedAtoms]
  );

  const handleChooseOrder = useCallback(
    (target: TargetBond, order: BondOrder) => {
      const key = lineKey(target.slotA, target.slotB);
      const nextChosen = { ...chosenOrders, [key]: order };
      setChosenOrders(nextChosen);
      setOpenOrderPickerFor(null);
      playSound("particleAdd");
      tryAutoFormBonds(placedAtoms, bonds, nextChosen);
    },
    [chosenOrders, placedAtoms, bonds, tryAutoFormBonds]
  );

  const handleSubmit = useCallback(() => {
    if (isPaused) return;
    attemptsRef.current += 1;
    playSound("submit");

    const result = checkStructure(payload.targetAtoms, payload.targetBonds, placedAtoms, bonds);

    if (result.correct) {
      setFeedback((f) => ({ ...f, visible: false }));
      runSuccessSequence({
        onPrimaryBeat: () => {
          setStabilized(true);
          setMascotPose("celebrate");
        },
        onSecondaryBeat: () => {
          setXpPop({ visible: true, amount: mission.xpReward });
        },
        onSequenceComplete: () => {
          const timeSpentSec = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
          onComplete({
            success: true,
            attemptsBeforeSuccess: attemptsRef.current,
            timeSpentSec,
            finalAtoms: { ...placedAtoms },
            finalBonds: [...bonds]
          });
        }
      });
    } else {
      const feedbackText = buildFeedback(result, payload.slots, placedAtoms, bonds, roster);
      runFailureSequence({
        onShowFeedback: () => setFeedback({ visible: true, text: feedbackText, entering: true }),
        onShake: () => setShaking(true),
        onShakeEnd: () => setShaking(false)
      });
      setMascotPose("encourage");
      setTimeout(() => setMascotPose(null), 900);
    }
  }, [isPaused, mission, payload, placedAtoms, bonds, roster, onComplete]);

  // XP stat REMOVED from the gameplay HUD per direct request ("you can
  // remove the XP at the top of the carbon builder game"). XP is still
  // fully awarded on mission completion — see handleSubmit's
  // runSuccessSequence / onComplete below and GameRuntime.tsx's
  // handleEngineComplete, which is what actually writes xp_awarded and
  // calls addXpToStudent — this ONLY removes the during-gameplay display.
  // The gameTitle prop passed to GameplayShell below now anchors that
  // row instead of a stat card.
  const stats: GameplayStat[] = [];

  // Layout: convert each slot's {row, col} into a CSS grid position. Row 0
  // is the carbon backbone; negative rows sit above it, positive rows
  // below — see carbonBuilderMissions.ts's file header for the full
  // layout convention this renders.
  const minRow = Math.min(...payload.slots.map((s) => s.row));
  const minCol = Math.min(...payload.slots.map((s) => s.col));
  const maxRow = Math.max(...payload.slots.map((s) => s.row));
  const maxCol = Math.max(...payload.slots.map((s) => s.col));
  const rowSpan = maxRow - minRow + 1;
  const colSpan = maxCol - minCol + 1;

  const helpText = needsOrderChoice
    ? "Drag atoms onto the dots. Tap a connecting line once both ends are filled to choose its bond type."
    : "Drag atoms onto the dots — lines connect by themselves once both ends are filled in.";

  return (
    <GameplayShell
      environmentImages={GAME_ENVIRONMENT_IMAGES["carbon-builder"]}
      fallbackGradient="radial-gradient(ellipse 90% 70% at 50% 0%, #2A3A5C 0%, #1B2438 55%, #11162A 100%)"
      accentColor={accentColor}
      stats={stats}
      missionPrompt={{ label: "Build This Molecule", text: payload.resultLabel }}
      menu={menu}
      gameTitle={gameTitle}
      isPaused={isPaused}
    >
      <div
        className={`${styles.engineColumn} ${shaking ? "shaking" : ""}`}
        style={{ "--cols": colSpan, "--rows": rowSpan } as React.CSSProperties}
      >
        <div className={styles.buildSurface} ref={buildSurfaceRef}>
          <div className={styles.slotGrid}>
            {payload.slots.map((slot) => {
              const symbol = placedAtoms[slot.id];
              const def = symbol ? atomDefBySymbol(roster, symbol) : undefined;
              const count = def ? bondCountForSlot(slot.id, bonds) : 0;
              const isRejecting = rejectingSlot === slot.id;
              const isFull = def ? count >= def.maxBonds : false;
              // Live "you're hovering this slot" highlight while a drag
              // is in progress — recomputed on every pointer move via
              // dragState.x/y, the same geometric hit-test
              // findSlotAtPoint uses on release, just run early for
              // visual feedback DURING the gesture rather than only at
              // the end. Only highlights slots that would actually
              // accept the dragged symbol, so the player sees valid
              // targets, not every empty slot indiscriminately.
              const isValidDropTarget =
                !def && dragState && slot.acceptsSymbols.includes(dragState.symbol) && findSlotAtPoint(dragState.x, dragState.y) === slot.id;

              return (
                <div
                  key={slot.id}
                  className={styles.slotCell}
                  style={{ gridRow: slot.row - minRow + 1, gridColumn: slot.col - minCol + 1 }}
                >
                  {def ? (
                    <button
                      className={[styles.atomChip, isRejecting ? styles.rejecting : "", isFull ? styles.full : ""].filter(Boolean).join(" ")}
                      style={{ "--el-color": def.hex } as React.CSSProperties}
                      onClick={() => handleClearSlot(slot.id)}
                      title="Tap to remove"
                    >
                      <span className={styles.atomSymbol}>{def.symbol}</span>
                      <span className={styles.bondCounter}>
                        {count}/{def.maxBonds}
                      </span>
                    </button>
                  ) : (
                    <div
                      ref={(el) => {
                        slotRefs.current[slot.id] = el;
                      }}
                      className={[styles.emptySlot, isValidDropTarget ? styles.emptySlotHover : "", isRejecting ? styles.emptySlotRejecting : ""]
                        .filter(Boolean)
                        .join(" ")}
                      data-slot-id={slot.id}
                    >
                      <span className={styles.emptySlotHint}>{slot.acceptsSymbols.join("/")}</span>
                    </div>
                  )}
                </div>
              );
            })}

            <BondLines
              slots={payload.slots}
              targetBonds={payload.targetBonds}
              bonds={bonds}
              placedAtoms={placedAtoms}
              chosenOrders={chosenOrders}
              minRow={minRow}
              minCol={minCol}
              rowSpan={rowSpan}
              colSpan={colSpan}
              onLineTap={handleLineTap}
            />
          </div>
        </div>

        <div className={styles.helpText}>{helpText}</div>

        <div className={styles.dockWrap}>
          <div className={styles.dock}>
            {dockAtoms.map((atom) => (
              <DockCapsule key={atom.symbol} atom={atom} onStartDrag={startDragFromDock} />
            ))}
          </div>
        </div>

        <button className={styles.submitButton} onClick={handleSubmit}>
          Submit
        </button>
      </div>

      {/* The actual visual "this atom is following your finger/cursor"
       *  feedback during a drag — fixed-positioned at the live pointer
       *  coordinates from dragState, updated every pointermove. Without
       *  this, a pure pointer-tracked drag (vs. native HTML5 DnD, which
       *  gives the browser's own drag ghost for free) would show NO
       *  visual indication an atom is actually being carried, which
       *  would itself be a confusing regression even though the
       *  underlying placement logic works. pointer-events: none so it
       *  never itself becomes a hit-test target. */}
      {dragState &&
        (() => {
          const def = atomDefBySymbol(roster, dragState.symbol);
          if (!def) return null;
          return (
            <div className={styles.dragGhost} style={{ left: dragState.x, top: dragState.y, "--el-color": def.hex } as React.CSSProperties}>
              {def.symbol}
            </div>
          );
        })()}

      {openOrderPickerFor &&
        (() => {
          const target = payload.targetBonds.find((b) => lineKey(b.slotA, b.slotB) === openOrderPickerFor);
          if (!target) return null;
          return (
            <div className={styles.orderPickerOverlay} onClick={() => setOpenOrderPickerFor(null)}>
              <div className={styles.orderPickerCard} onClick={(e) => e.stopPropagation()}>
                <div className={styles.orderPickerLabel}>Choose this bond's type</div>
                <div className={styles.orderPickerRow}>
                  {(["single", "double", "triple"] as BondOrder[]).map((order) => (
                    <button key={order} className={styles.orderPickerButton} onClick={() => handleChooseOrder(target, order)}>
                      {order === "single" ? "Single" : order === "double" ? "Double" : "Triple"}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

      {feedback.visible && (
        <div
          className={styles.feedbackRow}
          onAnimationEnd={() => setFeedback((f) => ({ ...f, visible: false, entering: false }))}
          onAnimationStart={() => setFeedback((f) => f.entering ? { ...f, entering: false } : f)}
        >
          <Mascot pose="encourage" widthPx={56} />
          <div className={`${styles.feedbackCard} ${feedback.entering ? styles.entering : ""}`}>
            <div className={styles.feedbackEyebrow}>Almost there</div>
            <div className={styles.feedbackText}>{feedback.text}</div>
          </div>
        </div>
      )}

      {xpPop.visible && (
        <div className={styles.xpPop} onAnimationEnd={() => setXpPop({ visible: false, amount: 0 })}>
          +{xpPop.amount} XP
        </div>
      )}

      {mascotPose && (
        <div className={styles.mascotPopup}>
          <Mascot pose={mascotPose} widthPx={76} />
        </div>
      )}
    </GameplayShell>
  );
}

/**
 * One dock capsule. REWRITTEN per direct feedback ("I drag, drop, then
 * I have to click before it shows — that is not a good user
 * experience"): the previous version layered native HTML5 drag-and-drop
 * (`draggable` + `onDragStart`) on TOP of a manual pointer-event
 * fallback, and the two interfered with each other — native DnD
 * requires a `dragover`+`drop` handler pair on the TARGET to accept a
 * drop at all, which `.emptySlot` never had, so a real drag gesture
 * silently failed every time; only a SEPARATE click afterward (landing
 * on the fallback's still-armed listener) ever actually worked. Fixed
 * by removing native DnD entirely and using ONE real pointer-tracked
 * drag, the same proven approach BondMatchEngine.tsx already uses
 * successfully — see MoleculeBuilderEngine's onStartDrag prop (passed
 * down as startDragFromDock) for the actual pointerdown/move/up
 * lifecycle, owned by the parent since hit-testing needs visibility
 * into every slot's DOM rect, not just this one capsule.
 */
function DockCapsule({ atom, onStartDrag }: { atom: AtomDef; onStartDrag: (e: React.PointerEvent, symbol: string) => void }) {
  return (
    <div
      className={styles.dockCapsule}
      style={{ "--el-color": atom.hex } as React.CSSProperties}
      onPointerDown={(e) => onStartDrag(e, atom.symbol)}
    >
      <div className={styles.dockChipInner}>{atom.symbol}</div>
      <div className={styles.dockLabel}>{atom.name}</div>
    </div>
  );
}

/**
 * Renders EVERY target bond as a line — DASHED while still open
 * (missing an atom on one or both ends, or for Hard-tier lines,
 * waiting on an order choice), SOLID the instant it's actually formed
 * (present in `bonds`). This is the core of the redesign: the full
 * skeleton shape is visible from the moment the mission loads, not
 * built up incrementally as the player guesses where bonds go — see
 * MoleculeBuilderEngine.tsx's file header for the full design
 * rationale.
 *
 * For Hard-tier lines where both ends are filled but no order has been
 * chosen yet, the line renders in a third, attention-getting state
 * (gold, slightly thicker) and is tappable via onLineTap — see the
 * order-picker overlay in the parent component.
 *
 * SVG coordinate system unchanged from the prior round's fix: draws in
 * grid-cell units via a viewBox sized to the actual grid dimensions, so
 * line positions stay correct at any breakpoint with no pixel constant
 * to keep in sync with CSS.
 */
function BondLines({
  slots,
  targetBonds,
  bonds,
  placedAtoms,
  chosenOrders,
  minRow,
  minCol,
  rowSpan,
  colSpan,
  onLineTap
}: {
  slots: { id: string; row: number; col: number }[];
  targetBonds: TargetBond[];
  bonds: PlacedBond[];
  placedAtoms: Record<string, string>;
  chosenOrders: Record<string, BondOrder>;
  minRow: number;
  minCol: number;
  rowSpan: number;
  colSpan: number;
  onLineTap: (target: TargetBond) => void;
}) {
  const positionOf = (slotId: string) => {
    const slot = slots.find((s) => s.id === slotId);
    if (!slot) return { x: 0, y: 0 };
    return {
      x: slot.col - minCol + 0.5,
      y: slot.row - minRow + 0.5
    };
  };

  return (
    <svg className={styles.bondSvg} viewBox={`0 0 ${colSpan} ${rowSpan}`} preserveAspectRatio="none">
      {targetBonds.map((target, i) => {
        const a = positionOf(target.slotA);
        const b = positionOf(target.slotB);
        const formed = bonds.find(
          (bond) =>
            (bond.slotA === target.slotA && bond.slotB === target.slotB) || (bond.slotA === target.slotB && bond.slotB === target.slotA)
        );
        const key = [target.slotA, target.slotB].sort().join("|");
        const bothEndsFilled = Boolean(placedAtoms[target.slotA]) && Boolean(placedAtoms[target.slotB]);
        const awaitingOrderChoice = !formed && target.order !== "single" && bothEndsFilled && !chosenOrders[key];

        const order = formed?.order ?? target.order;
        const lineCount = order === "single" ? 1 : order === "double" ? 2 : 3;
        const dx = b.y - a.y;
        const dy = -(b.x - a.x);
        const len = Math.hypot(dx, dy) || 1;
        const offsetUnit = { x: (dx / len) * 0.06, y: (dy / len) * 0.06 };

        const lineClass = [
          styles.bondLine,
          formed ? styles.bondLineFormed : styles.bondLineOpen,
          awaitingOrderChoice ? styles.bondLineAwaitingChoice : ""
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <g
            key={`${target.slotA}-${target.slotB}-${i}`}
            onClick={() => onLineTap(target)}
            className={awaitingOrderChoice ? styles.bondLineTappable : ""}
          >
            {/* Wide, invisible hit-area line so tapping near a thin
             * dashed line on a phone actually registers — the visible
             * line itself stays thin/elegant; this is purely a bigger
             * tap target sitting on top of it. */}
            {awaitingOrderChoice && (
              <line
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                stroke="transparent"
                strokeWidth={0.4}
                vectorEffect="non-scaling-stroke"
              />
            )}
            {Array.from({ length: formed ? lineCount : 1 }, (_, lineIdx) => {
              const spread = lineIdx - (lineCount - 1) / 2;
              return (
                <line
                  key={lineIdx}
                  x1={a.x + offsetUnit.x * spread}
                  y1={a.y + offsetUnit.y * spread}
                  x2={b.x + offsetUnit.x * spread}
                  y2={b.y + offsetUnit.y * spread}
                  className={lineClass}
                  vectorEffect="non-scaling-stroke"
                />
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
