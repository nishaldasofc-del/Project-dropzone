// client/src/ui/AuthManager.js
const API_BASE = `${import.meta.env.VITE_SERVER_URL || ''}/api/auth`;

export class AuthManager {
  constructor(game) {
    this.game = game;
    this.token = null;
    this.user = null;
    this.setupListeners();
  }

  setupListeners() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const target = tab.dataset.tab;
        document.getElementById('login-form').classList.toggle('hidden', target !== 'login');
        document.getElementById('register-form').classList.toggle('hidden', target !== 'register');
      });
    });

    // Login
    document.getElementById('login-btn')?.addEventListener('click', () => this.login());
    document.getElementById('login-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.login();
    });

    // Register
    document.getElementById('register-btn')?.addEventListener('click', () => this.register());
    document.getElementById('reg-password')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.register();
    });

    // Menu buttons
    document.getElementById('play-btn')?.addEventListener('click', () => {
      this.game.ui.showScreen('lobby');
      this.game.joinLobby();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      this.logout();
    });

    document.getElementById('leave-lobby-btn')?.addEventListener('click', () => {
      this.game.leaveLobby();
      this.game.ui.showScreen('menu');
    });
  }

  async login() {
    const username = document.getElementById('login-username')?.value?.trim();
    const password = document.getElementById('login-password')?.value;
    const errorEl = document.getElementById('login-error');

    if (!username || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }

    const btn = document.getElementById('login-btn');
    btn.textContent = 'Logging in...';
    btn.disabled = true;
    errorEl.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Login failed';
        return;
      }

      this.onLoginSuccess(data.token, data.user);
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
      console.error('Login error:', err);
    } finally {
      btn.textContent = 'ENTER THE ZONE';
      btn.disabled = false;
    }
  }

  async register() {
    const username = document.getElementById('reg-username')?.value?.trim();
    const email = document.getElementById('reg-email')?.value?.trim();
    const password = document.getElementById('reg-password')?.value;
    const errorEl = document.getElementById('register-error');

    if (!username || !email || !password) {
      errorEl.textContent = 'Please fill in all fields';
      return;
    }
    if (username.length < 3) {
      errorEl.textContent = 'Username must be at least 3 characters';
      return;
    }
    if (password.length < 6) {
      errorEl.textContent = 'Password must be at least 6 characters';
      return;
    }

    const btn = document.getElementById('register-btn');
    btn.textContent = 'Creating account...';
    btn.disabled = true;
    errorEl.textContent = '';

    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        errorEl.textContent = data.error || 'Registration failed';
        return;
      }

      this.onLoginSuccess(data.token, data.user);
    } catch (err) {
      errorEl.textContent = 'Connection error. Please try again.';
    } finally {
      btn.textContent = 'CREATE ACCOUNT';
      btn.disabled = false;
    }
  }

  async tryAutoLogin(token) {
    try {
      const res = await fetch(`${API_BASE}/me`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) return false;
      const data = await res.json();
      this.onLoginSuccess(token, data.user, true);
      return true;
    } catch {
      return false;
    }
  }

  onLoginSuccess(token, user, silent = false) {
    this.token = token;
    this.user = user;
    localStorage.setItem('dropzone_token', token);

    // Connect socket with token
    this.game.network.connect(token);

    // Update menu UI
    this.game.ui.updateMenuProfile(user);

    if (!silent) {
      this.game.ui.showScreen('menu');
    } else {
      this.game.ui.showScreen('menu');
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('dropzone_token');
    this.game.network.disconnect();
    this.game.ui.showScreen('auth');
  }
}
