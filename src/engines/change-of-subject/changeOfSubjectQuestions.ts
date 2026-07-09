/**
 * Change of Subject — Question Bank
 *
 * Organised into MISSIONS. Each mission is a self-contained set of 3–5
 * questions at a consistent difficulty level. The engine picks a mission
 * from the payload; if none is specified it picks randomly from the
 * appropriate tier's missions so the student always gets a fresh challenge.
 *
 * Difficulty bands:
 *   LEARN     — 1-step or 2-step, whole-number coefficients, one operation
 *   PRACTICE  — 2-step, may involve fractions or brackets
 *   CHALLENGE — 2–3 step, square roots, multi-variable, compound formulae
 */

import type { CosQuestion } from "./changeOfSubject.config";

const t  = (text: string, b = false) => ({ type: "term"  as const, t: text, b });
const f  = (n: string, d: string, b = false) => ({ type: "frac"  as const, n, d, b });
const sq = (inner: unknown[], b = false) => ({ type: "sqrt"  as const, inner, b });
const o  = (text: string) => ({ type: "op" as const, t: text });

// ─────────────────────────────────────────────────────────────────────────────
//  LEARN MISSIONS  (guided — simple 1 or 2-step)
// ─────────────────────────────────────────────────────────────────────────────

const LEARN_M1: CosQuestion[] = [
  {
    qLabel: "Make x the subject", formula: "x + 5 = 12", finalAnswer: "x = 7",
    steps: [{
      leftToks: [t("x"), o("+"), t("5", true)], rightToks: [t("12")],
      mascot: "We want <strong>x</strong> alone. <strong>+ 5</strong> is in the way — subtract 5 from both sides.",
      instPrac: "+ 5 is blocking x — subtract 5 from both sides.",
      instChall: "Make x the subject  ·  x + 5 = 12",
      hint: "The opposite of + 5 is − 5.",
      tileOk: "− 5", tilesNo: ["+ 5", "× 5"],
      whyNot: { "+ 5": "Adding 5 makes it bigger — moves away from removing it.", "× 5": "Multiplying doesn't cancel addition." },
      lqT: [t("x + 5 − 5")], lAns: "x", lWrong: ["x + 10", "x − 5"],
      rqT: [t("12 − 5")], rAns: "7", rWrong: ["17", "60"],
      newLeft: [t("x")], newRight: [t("7")],
    }],
  },
  {
    qLabel: "Make y the subject", formula: "y − 3 = 9", finalAnswer: "y = 12",
    steps: [{
      leftToks: [t("y"), o("−"), t("3", true)], rightToks: [t("9")],
      mascot: "<strong>− 3</strong> is blocking y — add 3 to both sides.",
      instPrac: "− 3 is blocking — add 3 to both sides.",
      instChall: "Make y the subject  ·  y − 3 = 9",
      hint: "The opposite of − 3 is + 3.",
      tileOk: "+ 3", tilesNo: ["− 3", "× 3"],
      whyNot: { "− 3": "Subtracting more makes y − 6 — going the wrong way.", "× 3": "Multiplying doesn't cancel subtraction." },
      lqT: [t("y − 3 + 3")], lAns: "y", lWrong: ["y − 6", "y + 3"],
      rqT: [t("9 + 3")], rAns: "12", rWrong: ["6", "27"],
      newLeft: [t("y")], newRight: [t("12")],
    }],
  },
  {
    qLabel: "Make n the subject", formula: "4n = 20", finalAnswer: "n = 5",
    steps: [{
      leftToks: [t("4n", true)], rightToks: [t("20")],
      mascot: "n is being <strong>multiplied by 4</strong> — divide both sides by 4.",
      instPrac: "n is multiplied by 4 — divide both sides by 4.",
      instChall: "Make n the subject  ·  4n = 20",
      hint: "÷ 4 undoes × 4.",
      tileOk: "÷ 4", tilesNo: ["× 4", "− 4"],
      whyNot: { "× 4": "Multiplying by 4 gives 16n — makes it bigger.", "− 4": "Subtracting 4 gives 4n − 4 — the coefficient stays." },
      lqT: [t("4n ÷ 4")], lAns: "n", lWrong: ["4", "n²"],
      rqT: [t("20 ÷ 4")], rAns: "5", rWrong: ["80", "16"],
      newLeft: [t("n")], newRight: [t("5")],
    }],
  },
  {
    qLabel: "Make m the subject", formula: "m/3 = 7", finalAnswer: "m = 21",
    steps: [{
      leftToks: [f("m", "3", true)], rightToks: [t("7")],
      mascot: "m is being <strong>divided by 3</strong> — multiply both sides by 3.",
      instPrac: "m is divided by 3 — multiply both sides by 3.",
      instChall: "Make m the subject  ·  m/3 = 7",
      hint: "× 3 cancels ÷ 3.",
      tileOk: "× 3", tilesNo: ["÷ 3", "+ 3"],
      whyNot: { "÷ 3": "Dividing again gives m/9 — goes deeper.", "+ 3": "Adding 3 doesn't remove the division." },
      lqT: [f("m","3"), t("× 3")], lAns: "m", lWrong: ["m/9", "3m"],
      rqT: [t("7 × 3")], rAns: "21", rWrong: ["10", "49"],
      newLeft: [t("m")], newRight: [t("21")],
    }],
  },
];

const LEARN_M2: CosQuestion[] = [
  {
    qLabel: "Make x the subject", formula: "2x + 4 = 10", finalAnswer: "x = 3",
    steps: [
      {
        leftToks: [t("2x"), o("+"), t("4", true)], rightToks: [t("10")],
        mascot: "<strong>+ 4</strong> is next to 2x — subtract 4 from both sides first.",
        instPrac: "+ 4 is blocking — subtract 4 from both sides.",
        instChall: "Make x the subject  ·  2x + 4 = 10",
        hint: "Subtract 4 first to leave 2x alone.",
        tileOk: "− 4", tilesNo: ["+ 4", "÷ 4"],
        whyNot: { "+ 4": "Adding 4 makes it 2x + 8 — moving further away.", "÷ 4": "Dividing by 4 gives (2x+4)/4 — introduces a fraction unnecessarily." },
        lqT: [t("2x + 4 − 4")], lAns: "2x", lWrong: ["2x + 8", "x"],
        rqT: [t("10 − 4")], rAns: "6", rWrong: ["14", "40"],
        newLeft: [t("2x")], newRight: [t("6")],
      },
      {
        leftToks: [t("2x", true)], rightToks: [t("6")],
        mascot: "Now x is <strong>multiplied by 2</strong> — divide both sides by 2.",
        instPrac: "x is multiplied by 2 — divide both sides by 2.",
        instChall: "Make x the subject  ·  2x + 4 = 10",
        hint: "÷ 2 leaves x alone.",
        tileOk: "÷ 2", tilesNo: ["× 2", "− 2"],
        whyNot: { "× 2": "Multiplying by 2 gives 4x — coefficient doubles.", "− 2": "Subtracting 2 gives 2x − 2 — the 2 coefficient remains." },
        lqT: [t("2x ÷ 2")], lAns: "x", lWrong: ["2", "x²"],
        rqT: [t("6 ÷ 2")], rAns: "3", rWrong: ["12", "4"],
        newLeft: [t("x")], newRight: [t("3")],
      },
    ],
  },
  {
    qLabel: "Make t the subject", formula: "3t − 6 = 9", finalAnswer: "t = 5",
    steps: [
      {
        leftToks: [t("3t"), o("−"), t("6", true)], rightToks: [t("9")],
        mascot: "<strong>− 6</strong> is next to 3t — add 6 to both sides.",
        instPrac: "− 6 is blocking — add 6 to both sides.",
        instChall: "Make t the subject  ·  3t − 6 = 9",
        hint: "+ 6 cancels − 6.",
        tileOk: "+ 6", tilesNo: ["− 6", "× 6"],
        whyNot: { "− 6": "Subtracting 6 gives 3t − 12 — makes it worse.", "× 6": "Multiplying by 6 doesn't remove the subtraction." },
        lqT: [t("3t − 6 + 6")], lAns: "3t", lWrong: ["3t − 12", "t"],
        rqT: [t("9 + 6")], rAns: "15", rWrong: ["3", "54"],
        newLeft: [t("3t")], newRight: [t("15")],
      },
      {
        leftToks: [t("3t", true)], rightToks: [t("15")],
        mascot: "t is <strong>multiplied by 3</strong> — divide both sides by 3.",
        instPrac: "t is multiplied by 3 — divide both sides by 3.",
        instChall: "Make t the subject  ·  3t − 6 = 9",
        hint: "÷ 3 isolates t.",
        tileOk: "÷ 3", tilesNo: ["× 3", "− 3"],
        whyNot: { "× 3": "Multiplying by 3 gives 9t — coefficient triples.", "− 3": "Subtracting 3 gives 3t − 3 — the 3 coefficient remains." },
        lqT: [t("3t ÷ 3")], lAns: "t", lWrong: ["3", "t³"],
        rqT: [t("15 ÷ 3")], rAns: "5", rWrong: ["45", "12"],
        newLeft: [t("t")], newRight: [t("5")],
      },
    ],
  },
  {
    qLabel: "Make k the subject", formula: "k/2 + 1 = 6", finalAnswer: "k = 10",
    steps: [
      {
        leftToks: [f("k","2"), o("+"), t("1", true)], rightToks: [t("6")],
        mascot: "<strong>+ 1</strong> is next to k/2 — subtract 1 from both sides.",
        instPrac: "+ 1 is blocking — subtract 1 from both sides.",
        instChall: "Make k the subject  ·  k/2 + 1 = 6",
        hint: "Subtract 1 first to leave k/2.",
        tileOk: "− 1", tilesNo: ["+ 1", "× 1"],
        whyNot: { "+ 1": "Adding 1 gives k/2 + 2 — increases the constant.", "× 1": "Multiplying by 1 changes nothing." },
        lqT: [f("k","2"), t("+ 1 − 1")], lAns: "k/2", lWrong: ["k/2 + 2", "k"],
        rqT: [t("6 − 1")], rAns: "5", rWrong: ["7", "6"],
        newLeft: [f("k","2")], newRight: [t("5")],
      },
      {
        leftToks: [f("k","2", true)], rightToks: [t("5")],
        mascot: "k is <strong>divided by 2</strong> — multiply both sides by 2.",
        instPrac: "k is divided by 2 — multiply both sides by 2.",
        instChall: "Make k the subject  ·  k/2 + 1 = 6",
        hint: "× 2 removes the division.",
        tileOk: "× 2", tilesNo: ["÷ 2", "+ 2"],
        whyNot: { "÷ 2": "Dividing again gives k/4 — fraction gets deeper.", "+ 2": "Adding 2 doesn't remove the division." },
        lqT: [f("k","2"), t("× 2")], lAns: "k", lWrong: ["k/4", "2k"],
        rqT: [t("5 × 2")], rAns: "10", rWrong: ["2.5", "25"],
        newLeft: [t("k")], newRight: [t("10")],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  PRACTICE MISSIONS  (2-step, brackets, fractions)
// ─────────────────────────────────────────────────────────────────────────────

const PRACTICE_M1: CosQuestion[] = [
  {
    qLabel: "Make t the subject", formula: "v = u + at", finalAnswer: "t = (v − u) / a",
    steps: [
      {
        leftToks: [t("u"), o("+"), t("at", true)], rightToks: [t("v")],
        mascot: "Subtract <strong>u</strong> from both sides to leave at alone.",
        instPrac: "u is blocking at — subtract u from both sides.",
        instChall: "Make t the subject  ·  v = u + at",
        hint: "The opposite of + u is − u.",
        tileOk: "− u", tilesNo: ["+ u", "÷ u"],
        whyNot: { "+ u": "Adding u makes it larger on that side.", "÷ u": "Dividing by u doesn't cancel the u we need to remove." },
        lqT: [t("u + at − u")], lAns: "at", lWrong: ["a+t", "u·t"],
        rqT: [t("v − u")], rAns: "v − u", rWrong: ["v+u", "v/u"],
        newLeft: [t("at")], newRight: [t("v − u")],
      },
      {
        leftToks: [t("at", true)], rightToks: [t("v − u")],
        mascot: "t is <strong>multiplied by a</strong> — divide both sides by a.",
        instPrac: "t is multiplied by a — divide both sides by a.",
        instChall: "Make t the subject  ·  v = u + at",
        hint: "÷ a leaves t on its own.",
        tileOk: "÷ a", tilesNo: ["× a", "− a"],
        whyNot: { "× a": "Multiplying by a gives a²t.", "− a": "Subtracting a doesn't remove the coefficient." },
        lqT: [t("at ÷ a")], lAns: "t", lWrong: ["a/t", "at²"],
        rqT: [t("(v − u) ÷ a")], rAns: "(v−u)/a", rWrong: ["v−u+a", "a(v−u)"],
        newLeft: [t("t")], newRight: [f("v − u", "a")],
      },
    ],
  },
  {
    qLabel: "Make l the subject", formula: "P = 2(l + w)", finalAnswer: "l = P/2 − w",
    steps: [
      {
        leftToks: [t("2(l + w)", true)], rightToks: [t("P")],
        mascot: "l is inside brackets <strong>multiplied by 2</strong> — divide both sides by 2.",
        instPrac: "l is inside brackets × 2 — divide both sides by 2.",
        instChall: "Make l the subject  ·  P = 2(l + w)",
        hint: "÷ 2 removes the coefficient outside the bracket.",
        tileOk: "÷ 2", tilesNo: ["× 2", "− 2"],
        whyNot: { "× 2": "Multiplying by 2 doubles the coefficient.", "− 2": "Subtracting 2 doesn't remove the 2 multiplying the bracket." },
        lqT: [t("2(l+w) ÷ 2")], lAns: "l + w", lWrong: ["2l+w", "l+2w"],
        rqT: [t("P ÷ 2")], rAns: "P/2", rWrong: ["2P", "P−2"],
        newLeft: [t("l + w")], newRight: [f("P", "2")],
      },
      {
        leftToks: [t("l"), o("+"), t("w", true)], rightToks: [f("P", "2")],
        mascot: "<strong>w</strong> is next to l — subtract w from both sides.",
        instPrac: "w is next to l — subtract w from both sides.",
        instChall: "Make l the subject  ·  P = 2(l + w)",
        hint: "− w cancels the + w.",
        tileOk: "− w", tilesNo: ["+ w", "× w"],
        whyNot: { "+ w": "Adding w makes w larger on l's side.", "× w": "Multiplying by w introduces w²." },
        lqT: [t("l + w − w")], lAns: "l", lWrong: ["l+2w", "l−w"],
        rqT: [f("P","2"), t("− w")], rAns: "P/2 − w", rWrong: ["P/2+w", "Pw/2"],
        newLeft: [t("l")], newRight: [f("P","2"), o("−"), t("w")],
      },
    ],
  },
  {
    qLabel: "Make x the subject", formula: "y = mx + c", finalAnswer: "x = (y − c) / m",
    steps: [
      {
        leftToks: [t("mx", true), o("+"), t("c")], rightToks: [t("y")],
        mascot: "<strong>c</strong> is on the same side as mx — subtract c from both sides.",
        instPrac: "c is blocking mx — subtract c from both sides.",
        instChall: "Make x the subject  ·  y = mx + c",
        hint: "Subtract c to leave mx alone.",
        tileOk: "− c", tilesNo: ["+ c", "÷ c"],
        whyNot: { "+ c": "Adding c makes it mx + 2c.", "÷ c": "Dividing by c doesn't remove the addition." },
        lqT: [t("mx + c − c")], lAns: "mx", lWrong: ["mx+2c", "m+x"],
        rqT: [t("y − c")], rAns: "y − c", rWrong: ["y+c", "y/c"],
        newLeft: [t("mx")], newRight: [t("y − c")],
      },
      {
        leftToks: [t("mx", true)], rightToks: [t("y − c")],
        mascot: "x is <strong>multiplied by m</strong> — divide both sides by m.",
        instPrac: "x is multiplied by m — divide both sides by m.",
        instChall: "Make x the subject  ·  y = mx + c",
        hint: "÷ m leaves x on its own.",
        tileOk: "÷ m", tilesNo: ["× m", "− m"],
        whyNot: { "× m": "Multiplying by m gives m²x.", "− m": "Subtracting m doesn't remove the coefficient." },
        lqT: [t("mx ÷ m")], lAns: "x", lWrong: ["m/x", "mx²"],
        rqT: [t("(y − c) ÷ m")], rAns: "(y−c)/m", rWrong: ["y−c+m", "m(y−c)"],
        newLeft: [t("x")], newRight: [f("y − c", "m")],
      },
    ],
  },
];

const PRACTICE_M2: CosQuestion[] = [
  {
    qLabel: "Make r the subject", formula: "A = πr²", finalAnswer: "r = √(A/π)",
    steps: [
      {
        leftToks: [t("πr²", true)], rightToks: [t("A")],
        mascot: "r² is <strong>multiplied by π</strong> — divide both sides by π.",
        instPrac: "r² is multiplied by π — divide both sides by π.",
        instChall: "Make r the subject  ·  A = πr²",
        hint: "÷ π removes the π coefficient.",
        tileOk: "÷ π", tilesNo: ["× π", "− π"],
        whyNot: { "× π": "Multiplying gives π²r².", "− π": "Subtracting π doesn't remove the coefficient." },
        lqT: [t("πr² ÷ π")], lAns: "r²", lWrong: ["r", "πr"],
        rqT: [t("A ÷ π")], rAns: "A/π", rWrong: ["Aπ", "A−π"],
        newLeft: [t("r²")], newRight: [f("A","π")],
      },
      {
        leftToks: [t("r²", true)], rightToks: [f("A","π")],
        mascot: "r is <strong>squared</strong> — take the square root of both sides.",
        instPrac: "r is squared — √ both sides removes the ².",
        instChall: "Make r the subject  ·  A = πr²",
        hint: "√(r²) = r",
        tileOk: "√( )", tilesNo: ["( )²", "÷ 2"],
        whyNot: { "( )²": "Squaring again gives r⁴.", "÷ 2": "Dividing by 2 doesn't remove the square." },
        lqT: [t("√(r²)")], lAns: "r", lWrong: ["r²", "2r"],
        rqT: [t("√(A/π)")], rAns: "√(A/π)", rWrong: ["A/π", "√A÷√π"],
        newLeft: [t("r")], newRight: [sq([f("A","π")])],
      },
    ],
  },
  {
    qLabel: "Make h the subject", formula: "V = lwh", finalAnswer: "h = V / (lw)",
    steps: [{
      leftToks: [t("lwh", true)], rightToks: [t("V")],
      mascot: "h is <strong>multiplied by lw</strong> — divide both sides by lw.",
      instPrac: "h is multiplied by lw — divide both sides by lw.",
      instChall: "Make h the subject  ·  V = lwh",
      hint: "÷ lw isolates h.",
      tileOk: "÷ lw", tilesNo: ["× lw", "− lw"],
      whyNot: { "× lw": "Multiplying by lw gives l²w²h.", "− lw": "Subtracting lw doesn't remove the coefficient." },
      lqT: [t("lwh ÷ lw")], lAns: "h", lWrong: ["lw/h", "h²"],
      rqT: [t("V ÷ lw")], rAns: "V/lw", rWrong: ["Vlw", "V+lw"],
      newLeft: [t("h")], newRight: [f("V","lw")],
    }],
  },
  {
    qLabel: "Make b the subject", formula: "A = ½bh", finalAnswer: "b = 2A / h",
    steps: [
      {
        leftToks: [t("½bh", true)], rightToks: [t("A")],
        mascot: "b is inside <strong>½ × b × h</strong> — multiply both sides by 2 to remove the ½.",
        instPrac: "b has a ½ coefficient — multiply both sides by 2.",
        instChall: "Make b the subject  ·  A = ½bh",
        hint: "× 2 removes the ½.",
        tileOk: "× 2", tilesNo: ["÷ 2", "+ 2"],
        whyNot: { "÷ 2": "Dividing by 2 gives ¼bh — fraction gets worse.", "+ 2": "Adding 2 doesn't remove the ½ coefficient." },
        lqT: [t("½bh × 2")], lAns: "bh", lWrong: ["½bh", "b+h"],
        rqT: [t("A × 2")], rAns: "2A", rWrong: ["A/2", "A+2"],
        newLeft: [t("bh")], newRight: [t("2A")],
      },
      {
        leftToks: [t("bh", true)], rightToks: [t("2A")],
        mascot: "b is <strong>multiplied by h</strong> — divide both sides by h.",
        instPrac: "b is multiplied by h — divide both sides by h.",
        instChall: "Make b the subject  ·  A = ½bh",
        hint: "÷ h leaves b alone.",
        tileOk: "÷ h", tilesNo: ["× h", "− h"],
        whyNot: { "× h": "Multiplying by h gives bh² — adds another h.", "− h": "Subtracting h doesn't remove the coefficient." },
        lqT: [t("bh ÷ h")], lAns: "b", lWrong: ["bh²", "b/h"],
        rqT: [t("2A ÷ h")], rAns: "2A/h", rWrong: ["2Ah", "2A+h"],
        newLeft: [t("b")], newRight: [f("2A","h")],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  CHALLENGE MISSIONS  (2–3 step, square roots, compound)
// ─────────────────────────────────────────────────────────────────────────────

const CHALLENGE_M1: CosQuestion[] = [
  {
    qLabel: "Make u the subject", formula: "s = ut + ½at²", finalAnswer: "u = (s − ½at²) / t",
    steps: [
      {
        leftToks: [t("ut", true), o("+"), t("½at²")], rightToks: [t("s")],
        mascot: "<strong>½at²</strong> is on the same side as ut — subtract it.",
        instPrac: "½at² is blocking — subtract it from both sides.",
        instChall: "Make u the subject  ·  s = ut + ½at²",
        hint: "Subtract ½at² to leave ut alone.",
        tileOk: "− ½at²", tilesNo: ["+ ½at²", "÷ t"],
        whyNot: { "+ ½at²": "Adding makes the term bigger.", "÷ t": "Dividing by t now splits ½at² messily." },
        lqT: [t("ut + ½at² − ½at²")], lAns: "ut", lWrong: ["ut+at²", "u+½t²"],
        rqT: [t("s − ½at²")], rAns: "s − ½at²", rWrong: ["s+½at²", "s/½at²"],
        newLeft: [t("ut")], newRight: [t("s − ½at²")],
      },
      {
        leftToks: [t("ut", true)], rightToks: [t("s − ½at²")],
        mascot: "u is <strong>multiplied by t</strong> — divide both sides by t.",
        instPrac: "u is multiplied by t — divide both sides by t.",
        instChall: "Make u the subject  ·  s = ut + ½at²",
        hint: "÷ t leaves u on its own.",
        tileOk: "÷ t", tilesNo: ["× t", "− t"],
        whyNot: { "× t": "Multiplying by t gives ut².", "− t": "Subtracting t gives ut − t — t still multiplies u." },
        lqT: [t("ut ÷ t")], lAns: "u", lWrong: ["ut²", "u/t"],
        rqT: [t("(s − ½at²) ÷ t")], rAns: "(s−½at²)/t", rWrong: ["t(s−½at²)", "s/t"],
        newLeft: [t("u")], newRight: [f("s − ½at²", "t")],
      },
    ],
  },
  {
    qLabel: "Make r the subject", formula: "V = (4/3)πr³", finalAnswer: "r = ∛(3V/4π)",
    steps: [
      {
        leftToks: [t("(4/3)πr³", true)], rightToks: [t("V")],
        mascot: "r³ is multiplied by <strong>(4/3)π</strong> — multiply both sides by 3 first.",
        instPrac: "Multiply both sides by 3 to clear the fraction.",
        instChall: "Make r the subject  ·  V = (4/3)πr³",
        hint: "× 3 clears the fraction ⅓.",
        tileOk: "× 3", tilesNo: ["÷ 3", "× π"],
        whyNot: { "÷ 3": "Dividing by 3 gives (4/9)πr³ — fraction worsens.", "× π": "Multiplying by π gives (4/3)π²r³ — adds another π." },
        lqT: [t("(4/3)πr³ × 3")], lAns: "4πr³", lWrong: ["(4/9)πr³", "12πr³"],
        rqT: [t("V × 3")], rAns: "3V", rWrong: ["V/3", "V+3"],
        newLeft: [t("4πr³")], newRight: [t("3V")],
      },
      {
        leftToks: [t("4πr³", true)], rightToks: [t("3V")],
        mascot: "r³ is still <strong>multiplied by 4π</strong> — divide both sides by 4π.",
        instPrac: "r³ is multiplied by 4π — divide both sides by 4π.",
        instChall: "Make r the subject  ·  V = (4/3)πr³",
        hint: "÷ 4π isolates r³.",
        tileOk: "÷ 4π", tilesNo: ["× 4π", "÷ π"],
        whyNot: { "× 4π": "Multiplying by 4π gives 16π²r³.", "÷ π": "Dividing by π alone leaves the 4 coefficient behind." },
        lqT: [t("4πr³ ÷ 4π")], lAns: "r³", lWrong: ["4r³", "πr³"],
        rqT: [t("3V ÷ 4π")], rAns: "3V/4π", rWrong: ["3V+4π", "12Vπ"],
        newLeft: [t("r³")], newRight: [f("3V","4π")],
      },
    ],
  },
  {
    qLabel: "Make l the subject", formula: "T = 2π√(l/g)", finalAnswer: "l = T²g / 4π²",
    steps: [
      {
        leftToks: [t("2π", true), sq([f("l","g")])], rightToks: [t("T")],
        mascot: "Divide both sides by <strong>2π</strong> to isolate the square root.",
        instPrac: "√(l/g) is × 2π — divide both sides by 2π.",
        instChall: "Make l the subject  ·  T = 2π√(l/g)",
        hint: "÷ 2π isolates the square root.",
        tileOk: "÷ 2π", tilesNo: ["× 2π", "− 2π"],
        whyNot: { "× 2π": "Multiplying gives 4π²√(l/g).", "− 2π": "Subtracting doesn't remove the coefficient." },
        lqT: [t("2π√(l/g) ÷ 2π")], lAns: "√(l/g)", lWrong: ["√(l/g)/2π", "2π√(l/g)"],
        rqT: [t("T ÷ 2π")], rAns: "T/2π", rWrong: ["2πT", "T−2π"],
        newLeft: [sq([f("l","g")])], newRight: [f("T","2π")],
      },
      {
        leftToks: [sq([f("l","g")], true)], rightToks: [f("T","2π")],
        mascot: "l is inside a square root — <strong>square both sides</strong>.",
        instPrac: "l is inside √ — square both sides.",
        instChall: "Make l the subject  ·  T = 2π√(l/g)",
        hint: "(√x)² = x",
        tileOk: "( )²", tilesNo: ["√( )", "÷ 2"],
        whyNot: { "√( )": "Another root gives ⁴√(l/g).", "÷ 2": "Dividing by 2 doesn't remove a square root." },
        lqT: [t("(√(l/g))²")], lAns: "l/g", lWrong: ["l²/g", "√(l/g)"],
        rqT: [f("T","2π"), t("²")], rAns: "T²/4π²", rWrong: ["T/4π²", "T²/2π"],
        newLeft: [f("l","g")], newRight: [f("T²","4π²")],
      },
      {
        leftToks: [f("l","g", true)], rightToks: [f("T²","4π²")],
        mascot: "l is <strong>divided by g</strong> — multiply both sides by g.",
        instPrac: "l is divided by g — multiply both sides by g.",
        instChall: "Make l the subject  ·  T = 2π√(l/g)",
        hint: "× g cancels ÷ g.",
        tileOk: "× g", tilesNo: ["÷ g", "+ g"],
        whyNot: { "÷ g": "Dividing again gives l/g².", "+ g": "Adding g doesn't remove the division." },
        lqT: [t("(l/g) × g")], lAns: "l", lWrong: ["l/g²", "lg"],
        rqT: [f("T²","4π²"), t("× g")], rAns: "T²g/4π²", rWrong: ["T²/4π²g", "gT²/2π"],
        newLeft: [t("l")], newRight: [f("T²g","4π²")],
      },
    ],
  },
];

const CHALLENGE_M2: CosQuestion[] = [
  {
    qLabel: "Make x the subject", formula: "y = (x + a) / b", finalAnswer: "x = by − a",
    steps: [
      {
        leftToks: [f("x + a","b", true)], rightToks: [t("y")],
        mascot: "x is inside a fraction — <strong>multiply both sides by b</strong>.",
        instPrac: "x is divided by b — multiply both sides by b.",
        instChall: "Make x the subject  ·  y = (x+a)/b",
        hint: "× b removes the denominator b.",
        tileOk: "× b", tilesNo: ["÷ b", "+ b"],
        whyNot: { "÷ b": "Dividing again gives (x+a)/b² — fraction deepens.", "+ b": "Adding b doesn't remove the division." },
        lqT: [f("x+a","b"), t("× b")], lAns: "x + a", lWrong: ["(x+a)/b²", "x+a+b"],
        rqT: [t("y × b")], rAns: "by", rWrong: ["y+b", "y/b"],
        newLeft: [t("x + a")], newRight: [t("by")],
      },
      {
        leftToks: [t("x"), o("+"), t("a", true)], rightToks: [t("by")],
        mascot: "<strong>+ a</strong> is next to x — subtract a from both sides.",
        instPrac: "+ a is blocking — subtract a from both sides.",
        instChall: "Make x the subject  ·  y = (x+a)/b",
        hint: "− a removes + a.",
        tileOk: "− a", tilesNo: ["+ a", "× a"],
        whyNot: { "+ a": "Adding a gives x + 2a.", "× a": "Multiplying introduces a² unnecessarily." },
        lqT: [t("x + a − a")], lAns: "x", lWrong: ["x+2a", "x−a"],
        rqT: [t("by − a")], rAns: "by − a", rWrong: ["by+a", "b/ya"],
        newLeft: [t("x")], newRight: [t("by − a")],
      },
    ],
  },
  {
    qLabel: "Make v the subject", formula: "E = ½mv²", finalAnswer: "v = √(2E/m)",
    steps: [
      {
        leftToks: [t("½mv²", true)], rightToks: [t("E")],
        mascot: "v² has <strong>½m</strong> in front — multiply both sides by 2 first.",
        instPrac: "Multiply both sides by 2 to clear the ½.",
        instChall: "Make v the subject  ·  E = ½mv²",
        hint: "× 2 removes the ½.",
        tileOk: "× 2", tilesNo: ["÷ 2", "× m"],
        whyNot: { "÷ 2": "Dividing by 2 gives ¼mv² — makes it worse.", "× m": "Multiplying by m gives ½m²v²." },
        lqT: [t("½mv² × 2")], lAns: "mv²", lWrong: ["¼mv²", "2mv²"],
        rqT: [t("E × 2")], rAns: "2E", rWrong: ["E/2", "E²"],
        newLeft: [t("mv²")], newRight: [t("2E")],
      },
      {
        leftToks: [t("mv²", true)], rightToks: [t("2E")],
        mascot: "v² is <strong>multiplied by m</strong> — divide both sides by m.",
        instPrac: "v² is multiplied by m — divide both sides by m.",
        instChall: "Make v the subject  ·  E = ½mv²",
        hint: "÷ m isolates v².",
        tileOk: "÷ m", tilesNo: ["× m", "− m"],
        whyNot: { "× m": "Multiplying by m gives m²v².", "− m": "Subtracting m doesn't remove the coefficient." },
        lqT: [t("mv² ÷ m")], lAns: "v²", lWrong: ["mv", "v²/m"],
        rqT: [t("2E ÷ m")], rAns: "2E/m", rWrong: ["2Em", "2E+m"],
        newLeft: [t("v²")], newRight: [f("2E","m")],
      },
    ],
  },
  {
    qLabel: "Make a the subject", formula: "v² = u² + 2as", finalAnswer: "a = (v² − u²) / 2s",
    steps: [
      {
        leftToks: [t("u²"), o("+"), t("2as", true)], rightToks: [t("v²")],
        mascot: "<strong>u²</strong> is on the same side as 2as — subtract u² from both sides.",
        instPrac: "u² is blocking 2as — subtract u² from both sides.",
        instChall: "Make a the subject  ·  v² = u² + 2as",
        hint: "Subtract u² to leave 2as alone.",
        tileOk: "− u²", tilesNo: ["+ u²", "÷ u"],
        whyNot: { "+ u²": "Adding u² makes it 2u² + 2as.", "÷ u": "Dividing by u introduces fractions in u." },
        lqT: [t("u² + 2as − u²")], lAns: "2as", lWrong: ["2u²+2as", "as"],
        rqT: [t("v² − u²")], rAns: "v² − u²", rWrong: ["v²+u²", "v²u²"],
        newLeft: [t("2as")], newRight: [t("v² − u²")],
      },
      {
        leftToks: [t("2as", true)], rightToks: [t("v² − u²")],
        mascot: "a is <strong>multiplied by 2s</strong> — divide both sides by 2s.",
        instPrac: "a is multiplied by 2s — divide both sides by 2s.",
        instChall: "Make a the subject  ·  v² = u² + 2as",
        hint: "÷ 2s leaves a on its own.",
        tileOk: "÷ 2s", tilesNo: ["× 2s", "÷ 2"],
        whyNot: { "× 2s": "Multiplying gives 4as² — moves further from a.", "÷ 2": "Dividing by 2 alone leaves s still multiplying a." },
        lqT: [t("2as ÷ 2s")], lAns: "a", lWrong: ["2a", "as"],
        rqT: [t("(v²−u²) ÷ 2s")], rAns: "(v²−u²)/2s", rWrong: ["2s(v²−u²)", "(v²−u²)+2s"],
        newLeft: [t("a")], newRight: [f("v² − u²","2s")],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
//  EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export type MissionKey =
  | "learn_m1" | "learn_m2"
  | "practice_m1" | "practice_m2"
  | "challenge_m1" | "challenge_m2";

export const MISSIONS: Record<MissionKey, CosQuestion[]> = {
  learn_m1:      LEARN_M1,
  learn_m2:      LEARN_M2,
  practice_m1:   PRACTICE_M1,
  practice_m2:   PRACTICE_M2,
  challenge_m1:  CHALLENGE_M1,
  challenge_m2:  CHALLENGE_M2,
};

export const MISSIONS_BY_TIER: Record<string, MissionKey[]> = {
  learn:     ["learn_m1", "learn_m2"],
  practice:  ["practice_m1", "practice_m2"],
  challenge: ["challenge_m1", "challenge_m2"],
};

/** Fallback: pick a random mission for the tier */
export function randomMissionForTier(tier: string): CosQuestion[] {
  const keys = MISSIONS_BY_TIER[tier] ?? MISSIONS_BY_TIER["learn"];
  const key = keys[Math.floor(Math.random() * keys.length)];
  return MISSIONS[key];
}

/** Legacy — used if no mission key is specified */
export const BUILTIN_QUESTIONS = PRACTICE_M1;