// client/src/ui/UIManager.js
export class UIManager {
  constructor(game) {
    this.game = game;
    this.currentScreen = 'loading';
    this.screens = {
      auth:   document.getElementById('auth-screen'),
      menu:   document.getElementById('main-menu'),
      lobby:  document.getElementById('lobby-screen'),
      game:   document.getElementById('game-canvas'),
    };
    this.lobbyPlayers = new Map();
  }

  showScreen(name) {
    // Hide all
    for (const [key, el] of Object.entries(this.screens)) {
      if (!el) continue;
      if (key === 'game') continue; // Canvas always rendered
      el.classList.add('hidden');
    }

    // Hide HUD when not in game
    if (name !== 'game') {
      this.game.hud?.hide();
    }

    // Show target
    const target = this.screens[name];
    if (target) target.classList.remove('hidden');

    this.currentScreen = name;
  }

  updateMenuProfile(user) {
    if (!user) return;
    const stats = user.stats || {};

    const setEl = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setEl('menu-username', user.username);
    setEl('menu-level', user.level || 1);
    setEl('stat-wins', stats.wins || 0);
    setEl('stat-kills', stats.kills || 0);
    setEl('stat-kd', stats.kd_ratio?.toFixed(2) || '0.00');
    setEl('stat-matches', stats.matches_played || 0);

    // XP bar
    const xpPct = user.xp_next_level > 0
      ? (user.xp / user.xp_next_level * 100).toFixed(1)
      : 0;
    const xpBar = document.getElementById('menu-xp-bar');
    if (xpBar) xpBar.style.width = xpPct + '%';
  }

  // ============================================================
  // LOBBY UI
  // ============================================================

  onAuthSuccess(data) {
    // Called when socket auth succeeds
  }

  onLobbyState(data) {
    document.getElementById('lobby-player-count').textContent = data.playerCount;
    this.lobbyPlayers.clear();
    const container = document.getElementById('lobby-players');
    if (!container) return;
    container.innerHTML = '';
    for (const p of (data.players || [])) {
      this.addLobbyPlayer(p.playerId, p.username);
    }
  }

  onLobbyPlayerJoin(data) {
    document.getElementById('lobby-player-count').textContent = data.playerCount;
    this.addLobbyPlayer(data.playerId, data.username);
    this.game.hud?.showNotification(`${data.username} joined`);
  }

  onLobbyPlayerLeave(data) {
    document.getElementById('lobby-player-count').textContent = data.playerCount;
    this.removeLobbyPlayer(data.playerId);
  }

  addLobbyPlayer(id, username) {
    if (this.lobbyPlayers.has(id)) return;
    const el = document.createElement('div');
    el.className = 'lobby-player-item';
    el.id = `lobby-player-${id}`;
    el.textContent = username;
    document.getElementById('lobby-players')?.appendChild(el);
    this.lobbyPlayers.set(id, el);
  }

  removeLobbyPlayer(id) {
    const el = this.lobbyPlayers.get(id);
    if (el) {
      el.remove();
      this.lobbyPlayers.delete(id);
    }
  }

  onLobbyCountdown(data) {
    const el = document.getElementById('lobby-countdown');
    if (!el) return;
    if (data.seconds <= 0) {
      el.textContent = 'DROPPING!';
      el.style.color = 'var(--clr-accent2)';
    } else {
      el.textContent = data.seconds;
      el.style.color = data.seconds <= 3 ? 'var(--clr-danger)' : 'var(--clr-accent)';
    }
  }
}
