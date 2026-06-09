// client/src/main.js
import { Game } from './core/Game.js';

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

    setProgress(80, 'Connecting systems...');
    await new Promise(r => setTimeout(r, 50)); // let browser paint the 80% bar

    // Create game instance
    game = new Game();
    window.__game = game;

    // Run heavy WebGL init inside setTimeout so the browser
    // can paint the loading screen first before blocking
    await new Promise((resolve, reject) => {
      setTimeout(async () => {
        try {
          await game.init();
          resolve();
        } catch(e) {
          reject(e);
        }
      }, 50);
    });

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

init();
