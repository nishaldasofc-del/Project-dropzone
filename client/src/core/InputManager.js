// client/src/core/InputManager.js
import { NETWORK_EVENTS } from '@dropzone/shared';

export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;

    // Keyboard state
    this.keys = new Set();

    // Mouse state
    this.mouse = { x: 0, y: 0, dx: 0, dy: 0, buttons: 0, locked: false };

    // Touch joysticks
    this.leftJoystick = { active: false, touchId: null, startX: 0, startY: 0, dx: 0, dy: 0, x: 0, y: 0 };
    this.rightJoystick = { active: false, touchId: null, startX: 0, startY: 0, dx: 0, dy: 0, x: 0, y: 0 };

    // Action buttons state
    this.actions = {
      fire: false, aim: false, jump: false, crouch: false,
      reload: false, inventory: false, sprint: false,
    };

    this.gameMode = false;
    this.isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent) || window.matchMedia('(pointer: coarse)').matches;

    this.setupKeyboard();
    this.setupMouse(canvas);
    if (this.isMobile) this.setupTouch();
    this.setupActionButtons();
  }

  setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!this.gameMode) return;
      this.keys.add(e.code);

      switch (e.code) {
        case 'KeyR': this.fireEvent('reload'); break;
        case 'KeyF': this.fireEvent('interact'); break;
        case 'KeyG': this.fireEvent('drop'); break;
        case 'Tab':
          e.preventDefault();
          this.fireEvent('inventory');
          break;
        case 'KeyM': this.fireEvent('map'); break;
        case 'Escape': this.fireEvent('escape'); break;
        case 'Digit1': this.fireEvent('weapon_slot', 0); break;
        case 'Digit2': this.fireEvent('weapon_slot', 1); break;
        case 'Digit3': this.fireEvent('weapon_slot', 2); break;
      }
    });

    document.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
  }

  setupMouse(canvas) {
    canvas.addEventListener('click', () => {
      if (this.gameMode && !this.mouse.locked) {
        canvas.requestPointerLock?.();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.mouse.locked = document.pointerLockElement === canvas;
    });

    document.addEventListener('mousemove', (e) => {
      if (!this.mouse.locked) return;
      this.mouse.dx += e.movementX;
      this.mouse.dy += e.movementY;
    });

    canvas.addEventListener('mousedown', (e) => {
      if (!this.gameMode) return;
      if (e.button === 0) { this.actions.fire = true; this.mouse.buttons |= 1; }
      if (e.button === 2) { this.actions.aim = true; this.mouse.buttons |= 2; }
    });

    canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) { this.actions.fire = false; this.mouse.buttons &= ~1; }
      if (e.button === 2) { this.actions.aim = false; this.mouse.buttons &= ~2; }
    });

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    canvas.addEventListener('wheel', (e) => {
      if (!this.gameMode) return;
      const dir = e.deltaY > 0 ? 1 : -1;
      this.fireEvent('weapon_scroll', dir);
    }, { passive: true });
  }

  setupTouch() {
    const leftZone = document.getElementById('left-joystick-zone');
    const rightZone = document.getElementById('right-joystick-zone');
    const leftBase = document.getElementById('left-joystick-base');
    const rightBase = document.getElementById('right-joystick-base');
    const leftKnob = document.getElementById('left-joystick-knob');
    const rightKnob = document.getElementById('right-joystick-knob');

    const MAX_RADIUS = 55;

    const handleTouchStart = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        const rect = this.canvas.getBoundingClientRect();
        const tx = touch.clientX;
        const ty = touch.clientY;

        // Left half = movement joystick
        if (tx < window.innerWidth * 0.45 && !this.leftJoystick.active) {
          this.leftJoystick.active = true;
          this.leftJoystick.touchId = touch.identifier;
          this.leftJoystick.startX = tx;
          this.leftJoystick.startY = ty;
          this.leftJoystick.dx = 0;
          this.leftJoystick.dy = 0;

          // Show joystick at touch position
          leftBase.style.left = (tx - 60) + 'px';
          leftBase.style.bottom = 'auto';
          leftBase.style.top = (ty - 60) + 'px';
          leftBase.style.display = 'block';
          leftKnob.style.transform = 'translate(-50%, -50%)';
        }
        // Right half = camera joystick
        else if (tx >= window.innerWidth * 0.55 && !this.rightJoystick.active) {
          // Check it's not an action button
          if (e.target.classList.contains('action-btn') || e.target.classList.contains('ws-slot')) continue;
          this.rightJoystick.active = true;
          this.rightJoystick.touchId = touch.identifier;
          this.rightJoystick.startX = tx;
          this.rightJoystick.startY = ty;
          this.rightJoystick.dx = 0;
          this.rightJoystick.dy = 0;

          rightBase.classList.remove('hidden');
          rightBase.style.position = 'fixed';
          rightBase.style.left = (tx - 60) + 'px';
          rightBase.style.top = (ty - 60) + 'px';
          rightKnob.style.transform = 'translate(-50%, -50%)';
        }
      }
    };

    const handleTouchMove = (e) => {
      e.preventDefault();
      for (const touch of e.changedTouches) {
        if (this.leftJoystick.touchId === touch.identifier) {
          const dx = touch.clientX - this.leftJoystick.startX;
          const dy = touch.clientY - this.leftJoystick.startY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const clamped = Math.min(dist, MAX_RADIUS);
          const angle = Math.atan2(dy, dx);
          this.leftJoystick.dx = Math.cos(angle) * clamped / MAX_RADIUS;
          this.leftJoystick.dy = Math.sin(angle) * clamped / MAX_RADIUS;

          // Update knob visual
          const kx = Math.cos(angle) * clamped;
          const ky = Math.sin(angle) * clamped;
          leftKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
        }
        if (this.rightJoystick.touchId === touch.identifier) {
          const dx = touch.clientX - this.rightJoystick.startX;
          const dy = touch.clientY - this.rightJoystick.startY;
          this.rightJoystick.dx = dx;
          this.rightJoystick.dy = dy;

          const dist = Math.sqrt(dx * dx + dy * dy);
          const clamped = Math.min(dist, MAX_RADIUS);
          const angle = Math.atan2(dy, dx);
          const kx = Math.cos(angle) * clamped;
          const ky = Math.sin(angle) * clamped;
          rightKnob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
        }
      }
    };

    const handleTouchEnd = (e) => {
      for (const touch of e.changedTouches) {
        if (this.leftJoystick.touchId === touch.identifier) {
          this.leftJoystick.active = false;
          this.leftJoystick.touchId = null;
          this.leftJoystick.dx = 0;
          this.leftJoystick.dy = 0;
          leftBase.style.display = 'none';
          leftKnob.style.transform = 'translate(-50%, -50%)';
        }
        if (this.rightJoystick.touchId === touch.identifier) {
          this.rightJoystick.active = false;
          this.rightJoystick.touchId = null;
          this.rightJoystick.dx = 0;
          this.rightJoystick.dy = 0;
          rightBase.classList.add('hidden');
          rightKnob.style.transform = 'translate(-50%, -50%)';
        }
      }
    };

    document.addEventListener('touchstart', handleTouchStart, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: false });
    document.addEventListener('touchcancel', handleTouchEnd, { passive: false });
  }

  setupActionButtons() {
    const btnMap = {
      'btn-fire':      () => { this.actions.fire = true; setTimeout(() => { this.actions.fire = false; }, 100); },
      'btn-aim':       () => { this.actions.aim = !this.actions.aim; },
      'btn-jump':      () => { this.actions.jump = true; setTimeout(() => { this.actions.jump = false; }, 150); },
      'btn-crouch':    () => { this.actions.crouch = !this.actions.crouch; },
      'btn-reload':    () => this.fireEvent('reload'),
      'btn-inventory': () => this.fireEvent('inventory'),
      'btn-map':       () => this.fireEvent('map'),
    };

    for (const [id, handler] of Object.entries(btnMap)) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      btn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        handler();
      }, { passive: true });
      btn.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        handler();
      });
    }

    // Fire button - held down
    const fireBtn = document.getElementById('btn-fire');
    if (fireBtn) {
      fireBtn.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        this.actions.fire = true;
      }, { passive: true });
      fireBtn.addEventListener('touchend', (e) => {
        e.stopPropagation();
        this.actions.fire = false;
      }, { passive: true });
    }

    // Weapon slots
    document.querySelectorAll('.ws-slot').forEach(slot => {
      slot.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        const slotIndex = parseInt(slot.dataset.slot);
        this.fireEvent('weapon_slot', slotIndex);
      }, { passive: true });
    });
  }

  update() {
    // Consume mouse delta (reset each frame)
    this._mouseDx = this.mouse.dx;
    this._mouseDy = this.mouse.dy;
    this.mouse.dx = 0;
    this.mouse.dy = 0;
  }

  getMouseDelta() {
    return { dx: this._mouseDx || 0, dy: this._mouseDy || 0 };
  }

  getJoystickDelta() {
    return {
      left: { x: this.leftJoystick.dx, y: this.leftJoystick.dy },
      right: { x: this.rightJoystick.dx, y: this.rightJoystick.dy },
    };
  }

  getGameInput() {
    if (this.isMobile) {
      return {
        forward:  this.leftJoystick.dy < -0.2,
        backward: this.leftJoystick.dy > 0.2,
        left:     this.leftJoystick.dx < -0.2,
        right:    this.leftJoystick.dx > 0.2,
        jump:     this.actions.jump,
        crouch:   this.actions.crouch,
        sprint:   Math.abs(this.leftJoystick.dx) > 0.8 || this.leftJoystick.dy < -0.8,
        fire:     this.actions.fire,
        ads:      this.actions.aim,
      };
    }
    return {
      forward:  this.keys.has('KeyW') || this.keys.has('ArrowUp'),
      backward: this.keys.has('KeyS') || this.keys.has('ArrowDown'),
      left:     this.keys.has('KeyA') || this.keys.has('ArrowLeft'),
      right:    this.keys.has('KeyD') || this.keys.has('ArrowRight'),
      jump:     this.keys.has('Space'),
      crouch:   this.keys.has('ControlLeft') || this.keys.has('KeyC'),
      sprint:   this.keys.has('ShiftLeft'),
      fire:     !!(this.mouse.buttons & 1),
      ads:      !!(this.mouse.buttons & 2),
    };
  }

  setGameMode(active) {
    this.gameMode = active;
    if (!active) {
      this.actions = { fire: false, aim: false, jump: false, crouch: false, reload: false, inventory: false, sprint: false };
      this.keys.clear();
      if (this.mouse.locked && document.exitPointerLock) {
        document.exitPointerLock();
      }
    }
  }

  fireEvent(name, data) {
    window.dispatchEvent(new CustomEvent('game:input', { detail: { name, data } }));
  }
}
