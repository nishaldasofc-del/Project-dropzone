// client/src/main.js
import { Game } from './core/Game.js';
import { AuthManager } from './ui/AuthManager.js';
import { NetworkManager } from './network/NetworkManager.js';

// Global game instance
let game = null;

async function init() {
  const loadingBar = document.getElementById('loading-bar');
  const loadingText = document.getElementById('loading-text');

  function setProgress(pct, text) {
    loadingBar.style.width = pct + '%';
    loadingText.textContent = text;
  }

  try {
    setProgress(10, 'Initializing engine...');
    await new Promise(r => setTimeout(r, 100));

    setProgress(30, 'Loading assets...');
    await new Promise(r => setTimeout(r, 150));

    setProgress(60, 'Preparing world...');
    await new Promise(r => setTimeout(r, 100));

    // Create game instance
    game = new Game();
    window.__game = game; // Debug access

    setProgress(80, 'Connecting systems...');
    await game.init();

    setProgress(100, 'Ready!');
    await new Promise(r => setTimeout(r, 300));

    // Hide loading, show auth
    document.getElementById('loading-screen').classList.add('hidden');

    // Check for stored session
    const token = localStorage.getItem('dropzone_token');
    if (token) {
      const success = await game.auth.tryAutoLogin(token);
      if (!success) {
        game.ui.showScreen('auth');
      }
    } else {
      game.ui.showScreen('auth');
    }

  } catch (err) {
    console.error('Failed to initialize game:', err);
    loadingText.textContent = 'Failed to load. Please refresh.';
    loadingBar.style.background = '#ff3355';
  }
}

// Start
init();
