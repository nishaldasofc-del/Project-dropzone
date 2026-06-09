// server/src/game/ZoneSystem.js
import { ZONE_CONFIG, MAP_CONFIG } from '@dropzone/shared';
import { randomInCircle } from '@dropzone/shared';

export class ZoneSystem {
  constructor(map) {
    this.map = map;

    // Zone state
    this.currentPhase = 0;
    this.isActive = false;
    this.isShrinking = false;
    this.isDamaging = false;

    // Current safe zone
    this.safeZone = {
      x: 0, z: 0,
      radius: (MAP_CONFIG.SIZE / 2) * 0.9,
    };

    // Next safe zone (target to shrink toward)
    this.nextZone = {
      x: 0, z: 0,
      radius: 0,
    };

    // Display zone (what client sees - animated)
    this.displayZone = {
      x: this.safeZone.x,
      z: this.safeZone.z,
      radius: this.safeZone.radius,
    };

    this.phaseTimer = null;
    this.shrinkTimer = null;
    this.damageTimer = null;
    this.lastChanged = false;
    this.lastDamaging = false;

    this.shrinkProgress = 0;
    this.shrinkDuration = 0;
    this.shrinkStartZone = null;
  }

  start() {
    this.isActive = true;
    this.currentPhase = 0;
    this.scheduleNextPhase();
  }

  stop() {
    clearTimeout(this.phaseTimer);
    clearInterval(this.damageTimer);
    this.isActive = false;
  }

  scheduleNextPhase() {
    if (this.currentPhase >= ZONE_CONFIG.PHASES.length) return;
    const phase = ZONE_CONFIG.PHASES[this.currentPhase];

    this.phaseTimer = setTimeout(() => {
      this.beginShrink(phase);
    }, phase.delay);

    // Warn players
    const warnTime = phase.delay - ZONE_CONFIG.WARN_BEFORE;
    if (warnTime > 0) {
      setTimeout(() => {
        this.lastChanged = true;
      }, warnTime);
    }
  }

  beginShrink(phase) {
    this.isShrinking = true;
    this.shrinkProgress = 0;
    this.shrinkDuration = phase.duration;
    this.shrinkStartZone = { ...this.safeZone };

    // Generate next zone randomly within current zone
    const maxOffset = this.safeZone.radius * (1 - phase.shrinkTo) * 0.5;
    const offset = randomInCircle(maxOffset);

    this.nextZone = {
      x: clamp(this.safeZone.x + offset.x, -MAP_CONFIG.SIZE / 2.2, MAP_CONFIG.SIZE / 2.2),
      z: clamp(this.safeZone.z + offset.y, -MAP_CONFIG.SIZE / 2.2, MAP_CONFIG.SIZE / 2.2),
      radius: this.safeZone.radius * phase.shrinkTo,
    };

    this.lastChanged = true;

    // Start damage
    this.isDamaging = true;
    this.currentDamage = phase.damage;

    // After shrink, update safe zone and go to next phase
    setTimeout(() => {
      this.safeZone = { ...this.nextZone };
      this.isShrinking = false;
      this.currentPhase++;
      this.scheduleNextPhase();
    }, phase.duration);
  }

  update(dt) {
    const changed = this.lastChanged;
    const damaging = this.isDamaging;
    this.lastChanged = false;

    if (this.isShrinking && this.shrinkDuration > 0) {
      this.shrinkProgress = Math.min(1, this.shrinkProgress + dt / (this.shrinkDuration / 1000));

      const t = this.easeInOut(this.shrinkProgress);
      this.displayZone = {
        x: lerp(this.shrinkStartZone.x, this.nextZone.x, t),
        z: lerp(this.shrinkStartZone.z, this.nextZone.z, t),
        radius: lerp(this.shrinkStartZone.radius, this.nextZone.radius, t),
      };
    }

    return {
      changed,
      damaging,
      data: this.getState(),
    };
  }

  getCurrentDamage() {
    return this.currentDamage || 0;
  }

  isPlayerInSafeZone(position) {
    const dx = position.x - this.displayZone.x;
    const dz = position.z - this.displayZone.z;
    return (dx * dx + dz * dz) <= this.displayZone.radius ** 2;
  }

  getState() {
    return {
      phase: this.currentPhase,
      safeZone: this.safeZone,
      nextZone: this.nextZone,
      displayZone: this.displayZone,
      isShrinking: this.isShrinking,
      isDamaging: this.isDamaging,
      damage: this.currentDamage || 0,
      shrinkProgress: this.shrinkProgress,
    };
  }

  easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
