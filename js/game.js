'use strict';

// ─── Game State Machine ───────────────────────────────────────────────────────

const STORAGE_KEY = 'sudoku-save-v1';

const MAX_HINTS = { easy: 5, medium: 3, hard: 2 };

class Game {
  constructor(onUpdate) {
    /** Called whenever state changes so the UI can re-render. */
    this.onUpdate = onUpdate;

    this.puzzle        = null;   // number[][] — original clues (0 = empty)
    this.solution      = null;   // number[][] — unique solution
    this.playerGrid    = null;   // number[][] — current player entries
    this.notes         = null;   // Set[][] — pencil marks per cell
    this.difficulty    = 'medium';
    this.selectedCell  = null;   // { row, col } | null
    this.notesMode     = false;
    this.hintsUsed     = 0;
    this.errorsCount   = 0;
    this.isComplete    = false;
    this.isPaused      = false;

    // Timer
    this._timerInterval   = null;
    this._resumeTime      = null;
    this._accumulated     = 0;   // ms accumulated before last pause
    this.elapsedSeconds   = 0;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  newGame(difficulty = 'medium') {
    this._stopTimer();

    this.difficulty   = difficulty;
    this.hintsUsed    = 0;
    this.errorsCount  = 0;
    this.isComplete   = false;
    this.isPaused     = false;
    this.selectedCell = null;
    this.notesMode    = false;
    this._accumulated = 0;
    this.elapsedSeconds = 0;

    const { puzzle, solution } = generatePuzzle(difficulty);
    this.puzzle     = puzzle;
    this.solution   = solution;
    this.playerGrid = puzzle.map(row => row.slice());
    this.notes      = Array.from({ length: 9 }, () =>
      Array.from({ length: 9 }, () => new Set())
    );

    this._startTimer();
    this._save();
    this.onUpdate('new-game');
  }

  selectCell(row, col) {
    if (this.isComplete || this.isPaused) return;
    this.selectedCell = { row, col };
    this.onUpdate('select');
  }

  inputNumber(num) {
    if (!this.selectedCell || this.isComplete || this.isPaused) return;
    const { row, col } = this.selectedCell;
    if (this.puzzle[row][col] !== 0) return; // given cell — immutable

    if (this.notesMode) {
      this._toggleNote(row, col, num);
      this._save();
      this.onUpdate('notes');
      return;
    }

    // Clear notes for this cell when entering a real number
    this.notes[row][col].clear();
    this.playerGrid[row][col] = num;

    if (num !== 0 && num !== this.solution[row][col]) {
      this.errorsCount++;
      this.onUpdate('error');
    } else {
      this.onUpdate('input');
    }

    if (isBoardComplete(this.playerGrid, this.solution)) {
      this._win();
    }

    this._save();
  }

  erase() {
    if (!this.selectedCell || this.isComplete || this.isPaused) return;
    const { row, col } = this.selectedCell;
    if (this.puzzle[row][col] !== 0) return;
    this.playerGrid[row][col] = 0;
    this.notes[row][col].clear();
    this._save();
    this.onUpdate('erase');
  }

  toggleNotesMode() {
    this.notesMode = !this.notesMode;
    this.onUpdate('notes-mode');
  }

  getHint() {
    if (!this.selectedCell || this.isComplete || this.isPaused) return false;
    const { row, col } = this.selectedCell;
    if (this.puzzle[row][col] !== 0) return false;
    if (this.playerGrid[row][col] === this.solution[row][col]) return false;

    const maxHints = MAX_HINTS[this.difficulty] ?? 3;
    if (this.hintsUsed >= maxHints) return false;

    this.hintsUsed++;
    this.notes[row][col].clear();
    this.playerGrid[row][col] = this.solution[row][col];

    if (isBoardComplete(this.playerGrid, this.solution)) {
      this._win();
    }

    this._save();
    this.onUpdate('hint');
    return true;
  }

  checkSolution() {
    if (this.isComplete || this.isPaused) return [];
    const errors = getErrors(this.playerGrid, this.solution);
    this.onUpdate('check');
    return errors;
  }

  pause() {
    if (this.isPaused || this.isComplete) return;
    this.isPaused = true;
    this._stopTimer();
    this.onUpdate('pause');
  }

  resume() {
    if (!this.isPaused || this.isComplete) return;
    this.isPaused = false;
    this._startTimer();
    this.onUpdate('resume');
  }

  /** Load a previously saved game. Returns true if a save was found. */
  loadSave() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);

      this.difficulty     = s.difficulty;
      this.puzzle         = s.puzzle;
      this.solution       = s.solution;
      this.playerGrid     = s.playerGrid;
      this.notes          = s.notes.map(row =>
        row.map(cell => new Set(cell))
      );
      this.hintsUsed      = s.hintsUsed;
      this.errorsCount    = s.errorsCount;
      this.isComplete     = s.isComplete;
      this.isPaused       = false;
      this.selectedCell   = null;
      this.notesMode      = false;
      this._accumulated   = s.elapsedMs;
      this.elapsedSeconds = Math.floor(s.elapsedMs / 1000);

      if (!this.isComplete) this._startTimer();
      this.onUpdate('loaded');
      return true;
    } catch {
      return false;
    }
  }

  clearSave() {
    localStorage.removeItem(STORAGE_KEY);
  }

  hasSave() {
    return !!localStorage.getItem(STORAGE_KEY);
  }

  formatTime(seconds = this.elapsedSeconds) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  maxHints() {
    return MAX_HINTS[this.difficulty] ?? 3;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  _toggleNote(row, col, num) {
    const set = this.notes[row][col];
    if (set.has(num)) set.delete(num);
    else set.add(num);
  }

  _win() {
    this.isComplete = true;
    this._stopTimer();
    this.clearSave();
    this.onUpdate('win');
  }

  _startTimer() {
    this._resumeTime = Date.now();
    this._timerInterval = setInterval(() => {
      const elapsed = this._accumulated + (Date.now() - this._resumeTime);
      this.elapsedSeconds = Math.floor(elapsed / 1000);
      this.onUpdate('tick');
    }, 1000);
  }

  _stopTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    if (this._resumeTime !== null) {
      this._accumulated += Date.now() - this._resumeTime;
      this._resumeTime = null;
    }
  }

  _save() {
    if (this.isComplete) return;
    const elapsed = this._accumulated +
      (this._resumeTime ? Date.now() - this._resumeTime : 0);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        difficulty:  this.difficulty,
        puzzle:      this.puzzle,
        solution:    this.solution,
        playerGrid:  this.playerGrid,
        notes:       this.notes.map(row => row.map(cell => [...cell])),
        hintsUsed:   this.hintsUsed,
        errorsCount: this.errorsCount,
        isComplete:  this.isComplete,
        elapsedMs:   elapsed,
      }));
    } catch { /* storage full — silently ignore */ }
  }
}
