'use strict';

// ─── Bootstrap ───────────────────────────────────────────────────────────────
// Wires Game + UI together, registers the service worker.

document.addEventListener('DOMContentLoaded', () => {

  // Instantiate the game with an update callback that delegates to the UI
  const game = new Game((event) => {
    ui.render(event);
  });

  // Instantiate the UI
  const ui = new UI(game);

  // On load: show resume prompt if a save exists, else show new-game picker
  if (game.hasSave()) {
    const modal = document.getElementById('modal-resume');
    // Show a summary in the resume modal
    try {
      const raw = localStorage.getItem('sudoku-save-v1');
      if (raw) {
        const save = JSON.parse(raw);
        const diff = save.difficulty.charAt(0).toUpperCase() + save.difficulty.slice(1);
        const mins = Math.floor((save.elapsedMs || 0) / 60000);
        const secs = Math.floor(((save.elapsedMs || 0) % 60000) / 1000);
        const time = `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
        document.getElementById('resume-info').textContent =
          `${diff} · ${time} elapsed`;
      }
    } catch { /* ignore */ }
    modal.classList.remove('hidden');
  } else {
    ui.showNewGameModal();
  }

  // Register service worker for offline support
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // SW not critical — app works without it
      });
    });
  }

});
