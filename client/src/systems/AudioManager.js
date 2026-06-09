// client/src/systems/AudioManager.js
import * as THREE from 'three';

// Procedural audio using Web Audio API - no asset files needed
export class AudioManager {
  constructor(camera) {
    this.camera = camera;
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);
    this.enabled = true;
    this._initialized = false;
  }

  init() {
    if (this._initialized) return;
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.8;
      this.masterGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 1.0;
      this.sfxGain.connect(this.masterGain);

      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.3;
      this.musicGain.connect(this.masterGain);

      this._initialized = true;
    } catch (e) {
      console.warn('AudioContext not available:', e);
      this.enabled = false;
    }
  }

  ensureInit() {
    if (!this._initialized) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Synthesize a gunshot sound
  playGunshot(weaponType, position, isLocal = false) {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;

    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Noise burst
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.1));
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    // Filter for weapon character
    const filter = ctx.createBiquadFilter();
    const gainNode = ctx.createGain();

    switch (weaponType) {
      case 'sniper':
        filter.type = 'bandpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.8;
        gainNode.gain.value = isLocal ? 0.9 : this.distanceGain(position);
        break;
      case 'shotgun':
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        gainNode.gain.value = isLocal ? 1.0 : this.distanceGain(position);
        break;
      case 'smg':
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 1.5;
        gainNode.gain.value = isLocal ? 0.6 : this.distanceGain(position) * 0.7;
        break;
      default: // AR / pistol
        filter.type = 'bandpass';
        filter.frequency.value = 800;
        filter.Q.value = 1.2;
        gainNode.gain.value = isLocal ? 0.75 : this.distanceGain(position);
    }

    source.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.sfxGain);

    gainNode.gain.setTargetAtTime(0, now + 0.05, 0.08);
    source.start(now);
    source.stop(now + 0.2);
  }

  playReload(weaponId) {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Click sounds for reload
    for (let i = 0; i < 2; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = 300 + i * 200;
      gain.gain.value = 0;
      gain.gain.setValueAtTime(0.15, now + i * 0.3);
      gain.gain.setTargetAtTime(0, now + i * 0.3 + 0.02, 0.01);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.3);
      osc.stop(now + i * 0.3 + 0.05);
    }
  }

  playHit() {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Flesh hit
    const bufferSize = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.6 * Math.exp(-i / (bufferSize * 0.2));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    const gain = ctx.createGain();
    gain.gain.value = 0.5;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
  }

  playHitMarker(isHeadshot) {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = isHeadshot ? 1200 : 900;
    gain.gain.value = 0.2;
    gain.gain.setTargetAtTime(0, now + 0.04, 0.02);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  playParachute() {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Wind rush
    const bufferSize = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / bufferSize * Math.PI);
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 400;
    filter.Q.value = 0.5;
    const gain = ctx.createGain();
    gain.gain.value = 0.3;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
  }

  playFootstep(surface = 'grass') {
    this.ensureInit();
    if (!this.enabled || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = surface === 'grass' ? 'lowpass' : 'highpass';
    filter.frequency.value = surface === 'grass' ? 500 : 1500;
    const gain = ctx.createGain();
    gain.gain.value = 0.08;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(now);
  }

  distanceGain(position) {
    if (!position || !this.camera) return 0.5;
    const dx = position.x - this.camera.position.x;
    const dy = position.y - this.camera.position.y;
    const dz = position.z - this.camera.position.z;
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return Math.max(0, 1 - dist / 500);
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, v));
  }

  setSFXVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = Math.max(0, Math.min(1, v));
  }

  update(dt, player) {
    if (!player?.isAlive) return;

    // Footstep timer
    if (!this._footstepTimer) this._footstepTimer = 0;
    this._footstepTimer -= dt;

    const speed = player.velocity ?
      Math.sqrt(player.velocity.x ** 2 + player.velocity.z ** 2) : 0;

    if (speed > 1 && player.isGrounded && this._footstepTimer <= 0) {
      const interval = player.isSprinting ? 0.28 : 0.45;
      this._footstepTimer = interval;
      this.playFootstep('grass');
    }
  }
}
