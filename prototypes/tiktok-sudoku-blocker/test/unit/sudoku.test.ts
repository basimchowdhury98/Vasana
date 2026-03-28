import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generatePuzzle } from "../../src/sudoku/generator.js";
import { solve, isValid } from "../../src/sudoku/solver.js";
import type { SudokuGrid } from "../../src/sudoku/types.js";

// Helper: count empty cells (zeros) in a grid
function countEmpty(grid: SudokuGrid): number {
  let count = 0;
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (grid[r][c] === 0) count++;
    }
  }
  return count;
}

// Helper: check that a completed grid has no Sudoku rule violations
function isCompleteAndValid(grid: SudokuGrid): boolean {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const val = grid[r][c];
      if (val < 1 || val > 9) return false;

      // Check row for duplicates
      for (let c2 = 0; c2 < 9; c2++) {
        if (c2 !== c && grid[r][c2] === val) return false;
      }
      // Check col for duplicates
      for (let r2 = 0; r2 < 9; r2++) {
        if (r2 !== r && grid[r2][c] === val) return false;
      }
      // Check 3x3 box for duplicates
      const boxR = Math.floor(r / 3) * 3;
      const boxC = Math.floor(c / 3) * 3;
      for (let br = boxR; br < boxR + 3; br++) {
        for (let bc = boxC; bc < boxC + 3; bc++) {
          if (br !== r && bc !== c && grid[br][bc] === val) return false;
        }
      }
    }
  }
  return true;
}

// ============================================================
// isValid() tests
// ============================================================
describe("isValid", () => {
  it("should return true for a valid placement in an empty grid", () => {
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    assert.equal(isValid(grid, 0, 0, 5), true);
  });

  it("should return false if the number already exists in the same row", () => {
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    grid[0][4] = 7;
    assert.equal(isValid(grid, 0, 0, 7), false);
  });

  it("should return false if the number already exists in the same column", () => {
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    grid[5][0] = 3;
    assert.equal(isValid(grid, 0, 0, 3), false);
  });

  it("should return false if the number already exists in the same 3x3 box", () => {
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    grid[1][1] = 9;
    assert.equal(isValid(grid, 0, 0, 9), false);
  });

  it("should return true if the number does not conflict anywhere", () => {
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    grid[0][1] = 1;
    grid[0][2] = 2;
    grid[1][0] = 4;
    grid[2][0] = 5;
    grid[1][1] = 6;
    // 3 should be valid at (0,0) - not in row, col, or box
    assert.equal(isValid(grid, 0, 0, 3), true);
  });
});

// ============================================================
// solve() tests
// ============================================================
describe("solve", () => {
  it("should solve a nearly-complete grid", () => {
    // A valid grid with just one cell missing
    const grid: SudokuGrid = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2],
      [6, 7, 2, 1, 9, 5, 3, 4, 8],
      [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3],
      [4, 2, 6, 8, 5, 3, 7, 9, 1],
      [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4],
      [2, 8, 7, 4, 1, 9, 6, 3, 5],
      [3, 4, 5, 2, 8, 6, 1, 7, 0], // last cell should be 9
    ];

    const result = solve(grid);
    assert.notEqual(result, null, "Solver should return a solution");
    assert.equal(result![8][8], 9, "Last cell should be 9");
    assert.ok(isCompleteAndValid(result!), "Solution should be valid");
  });

  it("should return null for an unsolvable grid", () => {
    // Two 5s in the same row = unsolvable
    const grid: SudokuGrid = Array.from({ length: 9 }, () => Array(9).fill(0));
    grid[0][0] = 5;
    grid[0][1] = 5;

    const result = solve(grid);
    assert.equal(result, null, "Should return null for unsolvable grid");
  });

  it("should solve a grid with many empty cells", () => {
    // A known easy puzzle
    const grid: SudokuGrid = [
      [5, 3, 0, 0, 7, 0, 0, 0, 0],
      [6, 0, 0, 1, 9, 5, 0, 0, 0],
      [0, 9, 8, 0, 0, 0, 0, 6, 0],
      [8, 0, 0, 0, 6, 0, 0, 0, 3],
      [4, 0, 0, 8, 0, 3, 0, 0, 1],
      [7, 0, 0, 0, 2, 0, 0, 0, 6],
      [0, 6, 0, 0, 0, 0, 2, 8, 0],
      [0, 0, 0, 4, 1, 9, 0, 0, 5],
      [0, 0, 0, 0, 8, 0, 0, 7, 9],
    ];

    const result = solve(grid);
    assert.notEqual(result, null, "Should be able to solve a valid puzzle");
    assert.ok(isCompleteAndValid(result!), "Solution should be valid");
  });
});

// ============================================================
// generatePuzzle() tests
// ============================================================
describe("generatePuzzle", () => {
  it("should return a puzzle with a 9x9 grid", () => {
    const { puzzle } = generatePuzzle();
    assert.equal(puzzle.length, 9, "Grid should have 9 rows");
    for (let r = 0; r < 9; r++) {
      assert.equal(puzzle[r].length, 9, `Row ${r} should have 9 columns`);
    }
  });

  it("should return a puzzle with 30-35 empty cells (easy difficulty)", () => {
    const { puzzle } = generatePuzzle();
    const empty = countEmpty(puzzle);
    assert.ok(
      empty >= 30 && empty <= 35,
      `Expected 30-35 empty cells, got ${empty}`
    );
  });

  it("should return a solution that is a valid complete grid", () => {
    const { solution } = generatePuzzle();
    assert.ok(
      isCompleteAndValid(solution),
      "Solution should be a valid completed Sudoku"
    );
  });

  it("should return a puzzle whose given cells match the solution", () => {
    const { puzzle, solution } = generatePuzzle();
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (puzzle[r][c] !== 0) {
          assert.equal(
            puzzle[r][c],
            solution[r][c],
            `Given cell (${r},${c}) should match the solution`
          );
        }
      }
    }
  });

  it("should generate puzzles with a unique solution", () => {
    const { puzzle } = generatePuzzle();
    // The puzzle should be solvable
    const result = solve(puzzle);
    assert.notEqual(result, null, "Generated puzzle should be solvable");
    assert.ok(isCompleteAndValid(result!), "Solution should be valid");
  });

  it("should generate different puzzles on consecutive calls", () => {
    const p1 = generatePuzzle();
    const p2 = generatePuzzle();

    // Flatten both puzzles and compare - they should differ
    const flat1 = p1.puzzle.flat().join(",");
    const flat2 = p2.puzzle.flat().join(",");
    assert.notEqual(flat1, flat2, "Two generated puzzles should not be identical");
  });
});
