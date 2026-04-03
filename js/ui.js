'use strict';

// ─── UI Layer ────────────────────────────────────────────────────────────────
// Owns all DOM reads/writes. Called by app.js after Game is instantiated.

class UI {
  constructor(game) {
    this.game = game;
    this._checkHighlights = []; // cells with temporary error highlight
    this._toastTimer = null;

    // Cache DOM references
    this.gridEl        = document.getElementById('grid');
    this.timerEl       = document.getElementById('timer');
    this.badgeEl       = document.getElementById('difficulty-badge');
    this.statErrors    = document.getElementById('stat-errors');
    this.statHints     = document.getElementById('stat-hints');
    this.btnPause      = document.getElementById('btn-pause');
    this.btnErase      = document.getElementById('btn-erase');
    this.btnNotes      = document.getElementById('btn-notes');
    this.btnHint       = document.getElementById('btn-hint');
    this.btnCheck      = document.getElementById('btn-check');
    this.numpad        = document.getElementById('numpad');
    this.toast         = document.getElementById('toast');

    // Modals
    this.modalNewGame  = document.getElementById('modal-new-game');
    this.modalPause    = document.getElementById('modal-pause');
    this.modalWin      = document.getElementById('modal-win');
    this.modalResume   = document.getElementById('modal-resume');

    this._buildGrid();
    this._bindEvents();
  }

  // ── Grid construction ───────────────────────────────────────────────────────

  _buildGrid() {
    this.gridEl.innerHTML = '';
    this._cells = [];

    for (let r = 0; r < 9; r++) {
      this._cells[r] = [];
      for (let c = 0; c < 9; c++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.setAttribute('role', 'gridcell');
        cell.setAttribute('data-row', r);
        cell.setAttribute('data-col', c);
        cell.setAttribute('tabindex', '0');

        // Touch/click — use touchstart for instant response on iPhone
        cell.addEventListener('touchstart', (e) => {
          e.preventDefault(); // prevent ghost click
          this.game.selectCell(r, c);
        }, { passive: false });
        cell.addEventListener('click', () => this.game.selectCell(r, c));

        this.gridEl.appendChild(cell);
        this._cells[r][c] = cell;
      }
    }
  }

  // ── Full re-render ──────────────────────────────────────────────────────────

  render(event) {
    const g = this.game;

    if (event === 'tick') {
      // Only update timer — skip full re-render for perf
      this.timerEl.textContent = g.formatTime();
      return;
    }

    if (event === 'win') {
      this._renderGrid();
      this._showWinModal();
      return;
    }

    if (event === 'pause') {
      document.getElementById('pause-timer-display').textContent = g.formatTime();
      this.modalPause.classList.remove('hidden');
      return;
    }

    if (event === 'resume') {
      this.modalPause.classList.add('hidden');
      return;
    }

    this._renderGrid();
    this._renderStats();
    this._renderControls();
    this._renderNumpad();
  }

  // ── Grid rendering ──────────────────────────────────────────────────────────

  _renderGrid() {
    const g = this.game;
    if (!g.puzzle) return;

    const sel  = g.selectedCell;
    const selR = sel?.row;
    const selC = sel?.col;
    const selVal = sel ? g.playerGrid[selR][selC] : 0;

    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        const cell   = this._cells[r][c];
        const isGiven = g.puzzle[r][c] !== 0;
        const val    = g.playerGrid[r][c];
        const notes  = g.notes[r][c];

        // Class list
        const classes = ['cell'];
        if (isGiven) {
          classes.push('given');
        } else if (val !== 0) {
          classes.push('player');
          if (val !== g.solution[r][c]) classes.push('error');
        }

        // Highlights relative to selection
        if (sel) {
          const isSel = r === selR && c === selC;
          if (isSel) {
            classes.push('selected');
          } else {
            const sameGroup = r === selR || c === selC ||
              (Math.floor(r / 3) === Math.floor(selR / 3) &&
               Math.floor(c / 3) === Math.floor(selC / 3));
            if (sameGroup) classes.push('highlighted');
            if (selVal !== 0 && val === selVal) classes.push('same-number');
          }
        }

        cell.className = classes.join(' ');
        cell.setAttribute('aria-label', `Row ${r + 1}, column ${c + 1}${val ? ', ' + val : ', empty'}`);

        // Content
        if (notes.size > 0 && val === 0 && !isGiven) {
          cell.classList.add('notes-cell');
          cell.innerHTML = '';
          for (let n = 1; n <= 9; n++) {
            const d = document.createElement('span');
            d.className = 'note-digit' + (notes.has(n) ? ' active' : '');
            d.textContent = notes.has(n) ? n : '';
            cell.appendChild(d);
          }
        } else {
          cell.innerHTML = '';
          cell.textContent = val || '';
        }
      }
    }
  }

  // ── Stats ───────────────────────────────────────────────────────────────────

  _renderStats() {
    const g = this.game;
    this.statErrors.textContent = g.errorsCount;
    this.statHints.textContent  = `${g.hintsUsed} / ${g.maxHints()}`;
    this.badgeEl.textContent    =
      g.difficulty.charAt(0).toUpperCase() + g.difficulty.slice(1);
    this.timerEl.textContent    = g.formatTime();
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  _renderControls() {
    const g = this.game;
    this.btnNotes.classList.toggle('active', g.notesMode);
    const noHints = g.hintsUsed >= g.maxHints();
    this.btnHint.classList.toggle('disabled', noHints);
  }

  // ── Number pad ──────────────────────────────────────────────────────────────

  _renderNumpad() {
    const g = this.game;
    // Count how many times each digit appears in the solved playerGrid
    const counts = new Array(10).fill(0);
    for (let r = 0; r < 9; r++) {
      for (let c = 0; c < 9; c++) {
        if (g.playerGrid[r][c] !== 0 && g.playerGrid[r][c] === g.solution[r][c]) {
          counts[g.playerGrid[r][c]]++;
        }
      }
    }
    this.numpad.querySelectorAll('.num-btn').forEach(btn => {
      const n = parseInt(btn.dataset.num, 10);
      btn.classList.toggle('exhausted', counts[n] >= 9);
    });
  }

  // ── Win modal ───────────────────────────────────────────────────────────────

  _showWinModal() {
    const g = this.game;
    document.getElementById('win-stats').textContent =
      `${g.difficulty.charAt(0).toUpperCase() + g.difficulty.slice(1)} · ` +
      `${g.formatTime()} · ${g.errorsCount} error${g.errorsCount !== 1 ? 's' : ''}`;
    this.modalWin.classList.remove('hidden');
  }

  // ── Toast ───────────────────────────────────────────────────────────────────

  showToast(msg, durationMs = 2000) {
    clearTimeout(this._toastTimer);
    this.toast.textContent = msg;
    this.toast.classList.remove('hidden');
    this._toastTimer = setTimeout(() => {
      this.toast.classList.add('hidden');
    }, durationMs);
  }

  // ── Event binding ───────────────────────────────────────────────────────────

  _bindEvents() {
    const g = this.game;

    // Number pad
    this.numpad.addEventListener('touchstart', (e) => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      e.preventDefault();
      g.inputNumber(parseInt(btn.dataset.num, 10));
    }, { passive: false });

    this.numpad.addEventListener('click', (e) => {
      const btn = e.target.closest('.num-btn');
      if (!btn) return;
      g.inputNumber(parseInt(btn.dataset.num, 10));
    });

    // Erase
    this.btnErase.addEventListener('click', () => g.erase());
    this.btnErase.addEventListener('touchstart', (e) => {
      e.preventDefault(); g.erase();
    }, { passive: false });

    // Notes toggle
    this.btnNotes.addEventListener('click', () => g.toggleNotesMode());

    // Hint
    this.btnHint.addEventListener('click', () => {
      const ok = g.getHint();
      if (!ok) this.showToast('No hints left!');
    });

    // Check
    this.btnCheck.addEventListener('click', () => {
      const errors = g.checkSolution();
      if (errors.length === 0) {
        this.showToast('Looking good — no errors found!');
      } else {
        this.showToast(`${errors.length} error${errors.length !== 1 ? 's' : ''} found`);
        this._renderGrid(); // re-render to show error highlights
      }
    });

    // Pause
    this.btnPause.addEventListener('click', () => g.pause());
    document.getElementById('btn-resume').addEventListener('click', () => g.resume());
    document.getElementById('btn-new-from-pause').addEventListener('click', () => {
      g.resume();
      this.modalPause.classList.add('hidden');
      this.showNewGameModal();
    });

    // Play again (win screen)
    document.getElementById('btn-play-again').addEventListener('click', () => {
      this.modalWin.classList.add('hidden');
      this.showNewGameModal();
    });

    // Resume save modal
    document.getElementById('btn-resume-save').addEventListener('click', () => {
      this.modalResume.classList.add('hidden');
      g.loadSave();
    });
    document.getElementById('btn-discard-save').addEventListener('click', () => {
      g.clearSave();
      this.modalResume.classList.add('hidden');
      this.showNewGameModal();
    });

    // Difficulty picker
    this.modalNewGame.querySelectorAll('.diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const diff = btn.dataset.diff;
        this.modalNewGame.classList.add('hidden');
        g.newGame(diff);
      });
    });

    // Keyboard support (desktop / iPad with keyboard)
    document.addEventListener('keydown', (e) => this._handleKey(e));
  }

  showNewGameModal() {
    this.modalNewGame.classList.remove('hidden');
  }

  _handleKey(e) {
    const g = this.game;
    if (!g.puzzle || g.isPaused) return;

    const key = e.key;

    if (key >= '1' && key <= '9') {
      g.inputNumber(parseInt(key, 10));
      return;
    }
    if (key === '0' || key === 'Backspace' || key === 'Delete') {
      g.erase();
      return;
    }
    if (key === 'n' || key === 'N') {
      g.toggleNotesMode();
      return;
    }

    // Arrow key navigation
    const sel = g.selectedCell;
    if (!sel) {
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(key)) {
        g.selectCell(0, 0);
      }
      return;
    }

    let { row, col } = sel;
    if (key === 'ArrowUp')    row = Math.max(0, row - 1);
    if (key === 'ArrowDown')  row = Math.min(8, row + 1);
    if (key === 'ArrowLeft')  col = Math.max(0, col - 1);
    if (key === 'ArrowRight') col = Math.min(8, col + 1);
    g.selectCell(row, col);
  }
}
