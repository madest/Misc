'use strict';

// ─── Sudoku Core Logic ───────────────────────────────────────────────────────
// Pure functions: no DOM dependency. Can be tested in Node.js directly.

const DIFFICULTY_CONFIG = {
  easy:   { cluesTarget: 36 },
  medium: { cluesTarget: 30 },
  hard:   { cluesTarget: 25 },
};

/** Return a new 9x9 array filled with zeros. */
function emptyGrid() {
  return Array.from({ length: 9 }, () => new Array(9).fill(0));
}

/** Deep-clone a 9x9 grid. */
function cloneGrid(grid) {
  return grid.map(row => row.slice());
}

/** Fisher-Yates shuffle in place; returns the array. */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Check whether placing `num` at (row, col) is valid in the current grid.
 * Does NOT check whether the cell is already filled.
 */
function isValidPlacement(grid, row, col, num) {
  // Row
  for (let c = 0; c < 9; c++) {
    if (grid[row][c] === num) return false;
  }
  // Column
  for (let r = 0; r < 9; r++) {
    if (grid[r][col] === num) return false;
  }
  // 3x3 box
  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;
  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

/**
 * Fill `grid` with a valid, randomised solution using backtracking.
 * Returns true on success, false on failure (should never fail on empty grid).
 */
function fillGrid(grid) {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (grid[row][col] !== 0) continue;

      const digits = shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      for (const num of digits) {
        if (isValidPlacement(grid, row, col, num)) {
          grid[row][col] = num;
          if (fillGrid(grid)) return true;
          grid[row][col] = 0;
        }
      }
      return false; // no digit worked → backtrack
    }
  }
  return true; // all cells filled
}

/**
 * Count solutions for `grid`, stopping once `limit` is reached.
 * Use limit=2 during puzzle generation to test for uniqueness efficiently.
 */
function countSolutions(grid, limit = 2) {
  let count = 0;

  function solve() {
    if (count >= limit) return;

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        if (grid[row][col] !== 0) continue;

        for (let num = 1; num <= 9; num++) {
          if (isValidPlacement(grid, row, col, num)) {
            grid[row][col] = num;
            solve();
            grid[row][col] = 0;
          }
        }
        return; // empty cell exhausted → dead end
      }
    }
    count++; // reached end with all cells filled
  }

  solve();
  return count;
}

/**
 * Generate a Sudoku puzzle.
 * @param {'easy'|'medium'|'hard'} difficulty
 * @returns {{ puzzle: number[][], solution: number[][] }}
 */
function generatePuzzle(difficulty = 'medium') {
  const config = DIFFICULTY_CONFIG[difficulty] || DIFFICULTY_CONFIG.medium;

  // Step 1: generate a complete random solution
  const solution = emptyGrid();
  fillGrid(solution);

  // Step 2: remove cells while keeping a unique solution
  const puzzle = cloneGrid(solution);
  const positions = shuffle(
    Array.from({ length: 81 }, (_, i) => [Math.floor(i / 9), i % 9])
  );

  let cluesLeft = 81;
  for (const [row, col] of positions) {
    if (cluesLeft <= config.cluesTarget) break;

    const backup = puzzle[row][col];
    puzzle[row][col] = 0;

    const test = cloneGrid(puzzle);
    if (countSolutions(test, 2) === 1) {
      cluesLeft--;
    } else {
      puzzle[row][col] = backup; // restore — removal breaks uniqueness
    }
  }

  return { puzzle, solution };
}

/**
 * Check whether the player's completed grid matches the solution.
 * Returns an array of { row, col } for any wrong cells, or [] if correct.
 */
function getErrors(playerGrid, solution) {
  const errors = [];
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (playerGrid[r][c] !== 0 && playerGrid[r][c] !== solution[r][c]) {
        errors.push({ row: r, col: c });
      }
    }
  }
  return errors;
}

/** Return true when every cell in playerGrid is filled and matches solution. */
function isBoardComplete(playerGrid, solution) {
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      if (playerGrid[r][c] !== solution[r][c]) return false;
    }
  }
  return true;
}
