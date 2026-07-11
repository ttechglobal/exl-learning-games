/**
 * simultaneousEquationsMissions.ts
 *
 * Authored mission content for the "Simultaneous Equations: Math Detective" game.
 * Each mission is one "case file" the player investigates.
 *
 * All authored content lives here, not in the engine component, per the
 * platform's Game/Mission split: the engine is generic, the cases are content.
 *
 * Progression model (removes scaffolding, doesn't just change numbers):
 *   EASY   — coefficients already match; one subtraction step eliminates
 *   MEDIUM — one multiplication step needed before elimination
 *   HARD   — both equations require transformation; player chooses variable
 *
 * These missions can be loaded into Game.shared_config + Mission.payload rows.
 * The `id` field here maps to Mission.id in the DB.
 */

import type {
  StepwiseEquationSolverMissionPayload
} from "./stepwiseEquationSolver.config";

export interface AuthoredMission {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  xpReward: number;
  payload: StepwiseEquationSolverMissionPayload;
}

// ─── EASY missions (guided elimination, coefficients already match) ───────────

const case0001: AuthoredMission = {
  id: "simeq-case-0001",
  title: "Case #0001",
  difficulty: "easy",
  xpReward: 20,
  payload: {
    caseNumber: "#0001",
    equations: [
      { id: "eq1", display: "x + y = 8" },
      { id: "eq2", display: "x − y = 2" }
    ],
    learningGoal: "Use subtraction to eliminate a variable.",
    solutionSteps: [
      {
        description: "Subtract eq2 from eq1",
        operation: "subtract",
        resultDisplay: ["2y = 6"],
        targetVariable: "y"
      },
      {
        description: "Solve for y",
        operation: "solve",
        resultDisplay: ["y = 3"],
        targetVariable: "y"
      },
      {
        description: "Substitute y = 3 into eq1",
        operation: "substitute",
        resultDisplay: ["x + 3 = 8", "x = 5"],
        targetVariable: "x",
        isFinal: true
      }
    ],
    alternativeValidOperations: ["add"],
    solution: { variables: { x: 5, y: 3 } },
    caseHints: [
      "Look at the y coefficients — they are equal and opposite.",
      "Subtracting one equation from the other will cancel out y.",
      "Select SUBTRACT to eliminate y."
    ]
  }
};

const case0002: AuthoredMission = {
  id: "simeq-case-0002",
  title: "Case #0002",
  difficulty: "easy",
  xpReward: 20,
  payload: {
    caseNumber: "#0002",
    equations: [
      { id: "eq1", display: "2x + y = 7" },
      { id: "eq2", display: "x − y = 2" }
    ],
    learningGoal: "Add equations to eliminate a variable with opposite signs.",
    solutionSteps: [
      {
        description: "Add eq1 and eq2",
        operation: "add",
        resultDisplay: ["3x = 9"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 3"],
        targetVariable: "x"
      },
      {
        description: "Substitute x = 3 into eq2",
        operation: "substitute",
        resultDisplay: ["3 − y = 2", "y = 1"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: [],
    solution: { variables: { x: 3, y: 1 } },
    caseHints: [
      "Look at the y coefficients — +1 and −1.",
      "Adding the two equations will make y cancel out.",
      "Select ADD to eliminate y."
    ]
  }
};

const case0003: AuthoredMission = {
  id: "simeq-case-0003",
  title: "Case #0003",
  difficulty: "easy",
  xpReward: 20,
  payload: {
    caseNumber: "#0003",
    equations: [
      { id: "eq1", display: "3x + 2y = 16" },
      { id: "eq2", display: "x + 2y = 8" }
    ],
    learningGoal: "Subtract when both equations share a common coefficient.",
    solutionSteps: [
      {
        description: "Subtract eq2 from eq1",
        operation: "subtract",
        resultDisplay: ["2x = 8"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 4"],
        targetVariable: "x"
      },
      {
        description: "Substitute x = 4 into eq2",
        operation: "substitute",
        resultDisplay: ["4 + 2y = 8", "y = 2"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: [],
    solution: { variables: { x: 4, y: 2 } },
    caseHints: [
      "The y coefficient is 2 in both equations.",
      "Subtracting the equations will eliminate y.",
      "Select SUBTRACT to remove y from the system."
    ]
  }
};

// ─── MEDIUM missions (one multiply step required) ─────────────────────────────

const case0101: AuthoredMission = {
  id: "simeq-case-0101",
  title: "Case #0101",
  difficulty: "medium",
  xpReward: 40,
  payload: {
    caseNumber: "#0101",
    equations: [
      { id: "eq1", display: "2x + 3y = 12" },
      { id: "eq2", display: "x + y = 5" }
    ],
    learningGoal: "Multiply one equation to create matching coefficients.",
    solutionSteps: [
      {
        description: "Multiply eq2 by 2",
        operation: "multiply_eq2",
        resultDisplay: ["2x + 3y = 12", "2x + 2y = 10"],
        targetVariable: "x",
        multiplyFactor: 2
      },
      {
        description: "Subtract new eq2 from eq1",
        operation: "subtract",
        resultDisplay: ["y = 2"],
        targetVariable: "x"
      },
      {
        description: "Substitute y = 2 into eq2",
        operation: "substitute",
        resultDisplay: ["x + 2 = 5", "x = 3"],
        targetVariable: "x",
        isFinal: true
      }
    ],
    alternativeValidOperations: ["multiply_eq1"],
    solution: { variables: { x: 3, y: 2 } },
    caseHints: [
      "The x coefficients are 2 and 1. Multiply to make them match.",
      "Multiply equation 2 by 2 to get 2x in both equations.",
      "Select MULTIPLY EQ 2 (× 2)."
    ]
  }
};

const case0102: AuthoredMission = {
  id: "simeq-case-0102",
  title: "Case #0102",
  difficulty: "medium",
  xpReward: 40,
  payload: {
    caseNumber: "#0102",
    equations: [
      { id: "eq1", display: "4x − y = 11" },
      { id: "eq2", display: "2x + y = 7" }
    ],
    learningGoal: "Identify when adding eliminates a variable directly.",
    solutionSteps: [
      {
        description: "Add eq1 and eq2",
        operation: "add",
        resultDisplay: ["6x = 18"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 3"],
        targetVariable: "x"
      },
      {
        description: "Substitute x = 3 into eq2",
        operation: "substitute",
        resultDisplay: ["2(3) + y = 7", "y = 1"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: [],
    solution: { variables: { x: 3, y: 1 } },
    caseHints: [
      "The y values are −1 and +1. They cancel by adding.",
      "No multiplication needed — adding the equations eliminates y directly.",
      "Select ADD to eliminate y."
    ]
  }
};

const case0103: AuthoredMission = {
  id: "simeq-case-0103",
  title: "Case #0103",
  difficulty: "medium",
  xpReward: 40,
  payload: {
    caseNumber: "#0103",
    equations: [
      { id: "eq1", display: "5x + 2y = 24" },
      { id: "eq2", display: "3x − y = 7" }
    ],
    learningGoal: "Multiply to create matching coefficients for elimination.",
    solutionSteps: [
      {
        description: "Multiply eq2 by 2",
        operation: "multiply_eq2",
        resultDisplay: ["5x + 2y = 24", "6x − 2y = 14"],
        targetVariable: "y",
        multiplyFactor: 2
      },
      {
        description: "Add the equations",
        operation: "add",
        resultDisplay: ["11x = 38"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 38/11 ≈ 3.45"],
        targetVariable: "x"
      },
      {
        description: "Substitute x into eq2",
        operation: "substitute",
        resultDisplay: ["3(38/11) − y = 7", "y = 7/11 ≈ 0.64"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: [],
    solution: { variables: { x: 3, y: 1 } },
    caseHints: [
      "The y coefficients are 2 and −1. Multiply equation 2 by 2.",
      "This will make the y terms +2y and −2y, which cancel when added.",
      "Select MULTIPLY EQ 2 (× 2)."
    ]
  }
};

// ─── HARD missions (full independent solving, no scaffolding) ─────────────────

const case0201: AuthoredMission = {
  id: "simeq-case-0201",
  title: "Case #0201",
  difficulty: "hard",
  xpReward: 75,
  payload: {
    caseNumber: "#0201",
    equations: [
      { id: "eq1", display: "3x + 2y = 20" },
      { id: "eq2", display: "2x + 5y = 22" }
    ],
    learningGoal: "Choose the correct multiplication factor to eliminate a variable.",
    solutionSteps: [
      {
        description: "Multiply eq1 by 5",
        operation: "multiply_eq1",
        resultDisplay: ["15x + 10y = 100", "2x + 5y = 22"],
        targetVariable: "y",
        multiplyFactor: 5
      },
      {
        description: "Multiply eq2 by 2",
        operation: "multiply_eq2",
        resultDisplay: ["15x + 10y = 100", "4x + 10y = 44"],
        targetVariable: "y",
        multiplyFactor: 2
      },
      {
        description: "Subtract new eq2 from new eq1",
        operation: "subtract",
        resultDisplay: ["11x = 56"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 4"],
        targetVariable: "x"
      },
      {
        description: "Substitute x = 4 into eq1",
        operation: "substitute",
        resultDisplay: ["3(4) + 2y = 20", "y = 4"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: ["multiply_eq2"],
    solution: { variables: { x: 4, y: 4 } },
    caseHints: [
      "Neither variable has matching coefficients. You need to multiply both equations.",
      "To eliminate y: multiply eq1 by 5 and eq2 by 2 to get 10y in both.",
      "Start with MULTIPLY EQ 1 (× 5)."
    ]
  }
};

const case0202: AuthoredMission = {
  id: "simeq-case-0202",
  title: "Case #0202",
  difficulty: "hard",
  xpReward: 75,
  payload: {
    caseNumber: "#0202",
    equations: [
      { id: "eq1", display: "7x − 3y = 1" },
      { id: "eq2", display: "4x + 2y = 16" }
    ],
    learningGoal: "Determine the optimal variable to eliminate in a complex system.",
    solutionSteps: [
      {
        description: "Multiply eq1 by 2",
        operation: "multiply_eq1",
        resultDisplay: ["14x − 6y = 2", "4x + 2y = 16"],
        targetVariable: "y",
        multiplyFactor: 2
      },
      {
        description: "Multiply eq2 by 3",
        operation: "multiply_eq2",
        resultDisplay: ["14x − 6y = 2", "12x + 6y = 48"],
        targetVariable: "y",
        multiplyFactor: 3
      },
      {
        description: "Add the equations",
        operation: "add",
        resultDisplay: ["26x = 50"],
        targetVariable: "y"
      },
      {
        description: "Solve for x",
        operation: "solve",
        resultDisplay: ["x = 25/13 ≈ 1.92"],
        targetVariable: "x"
      },
      {
        description: "Substitute x into eq2",
        operation: "substitute",
        resultDisplay: ["4(25/13) + 2y = 16", "y ≈ 4.15"],
        targetVariable: "y",
        isFinal: true
      }
    ],
    alternativeValidOperations: [],
    solution: { variables: { x: 2, y: 4 } },
    caseHints: [
      "To eliminate y: make coefficients match. They are −3 and +2.",
      "Multiply eq1 by 2 and eq2 by 3 to get −6y and +6y.",
      "Start with MULTIPLY EQ 1 (× 2)."
    ]
  }
};

// ─── Mission registry ─────────────────────────────────────────────────────────

export const simultaneousEquationsMissions: AuthoredMission[] = [
  // EASY (shown first)
  case0001,
  case0002,
  case0003,
  // MEDIUM
  case0101,
  case0102,
  case0103,
  // HARD
  case0201,
  case0202
];

/**
 * Look up a mission by id — used by GameRuntime to load the right payload.
 */
export function getMissionById(id: string): AuthoredMission | undefined {
  return simultaneousEquationsMissions.find((m) => m.id === id);
}

/**
 * Get missions filtered by difficulty — used for level selection UI.
 */
export function getMissionsByDifficulty(
  difficulty: "easy" | "medium" | "hard"
): AuthoredMission[] {
  return simultaneousEquationsMissions.filter((m) => m.difficulty === difficulty);
}