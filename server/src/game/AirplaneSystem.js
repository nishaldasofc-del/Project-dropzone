// server/src/game/AirplaneSystem.js
import { MAP_CONFIG } from '@dropzone/shared';
import { randomRange } from '@dropzone/shared';

export class AirplaneSystem {
  constructor() {
    this.position = { x: 0, y: MAP_CONFIG.AIRPLANE_ALTITUDE, z: 0 };
    this.startPos = null;
    this.endPos = null;
    this.direction = { x: 0, z: -1 };
    this.speed = MAP_CONFIG.AIRPLANE_SPEED;
    this.progress = 0;
    this.flightDuration = 0;
    this.elapsed = 0;
    this.jumpInterval = 0;
    this.totalLength = 0;
  }

  generatePath() {
    // Random entry from edge of map
    const halfMap = MAP_CONFIG.SIZE / 2;
    const angle = Math.random() * Math.PI * 2;

    this.startPos = {
      x: Math.cos(angle) * halfMap * 1.1,
      y: MAP_CONFIG.AIRPLANE_ALTITUDE,
      z: Math.sin(angle) * halfMap * 1.1,
    };

    // Go to opposite side with slight variation
    const exitAngle = angle + Math.PI + (Math.random() - 0.5) * 0.5;
    this.endPos = {
      x: Math.cos(exitAngle) * halfMap * 1.1,
      y: MAP_CONFIG.AIRPLANE_ALTITUDE,
      z: Math.sin(exitAngle) * halfMap * 1.1,
    };

    this.position = { ...this.startPos };

    const dx = this.endPos.x - this.startPos.x;
    const dz = this.endPos.z - this.startPos.z;
    this.totalLength = Math.sqrt(dx * dx + dz * dz);

    const dirLen = Math.sqrt(dx * dx + dz * dz);
    this.direction = { x: dx / dirLen, z: dz / dirLen };

    this.flightDuration = (this.totalLength / this.speed) * 1000;
    this.elapsed = 0;
    this.progress = 0;

    return {
      startPos: this.startPos,
      endPos: this.endPos,
      altitude: MAP_CONFIG.AIRPLANE_ALTITUDE,
      speed: this.speed,
      duration: this.flightDuration,
    };
  }

  update(dt) {
    this.elapsed += dt * 1000;
    this.progress = Math.min(1, this.elapsed / this.flightDuration);

    this.position = {
      x: this.startPos.x + (this.endPos.x - this.startPos.x) * this.progress,
      y: MAP_CONFIG.AIRPLANE_ALTITUDE,
      z: this.startPos.z + (this.endPos.z - this.startPos.z) * this.progress,
    };

    return {
      x: this.position.x,
      y: this.position.y,
      z: this.position.z,
      progress: this.progress,
    };
  }

  getJumpPosition(playerIndex = 0) {
    // Stagger jump positions slightly along the path
    const offset = playerIndex * 20;
    const t = Math.min(this.progress + offset / this.totalLength, 1);
    return {
      x: this.startPos.x + (this.endPos.x - this.startPos.x) * t,
      y: MAP_CONFIG.AIRPLANE_ALTITUDE,
      z: this.startPos.z + (this.endPos.z - this.startPos.z) * t,
    };
  }

  getCurrentPosition() {
    return { ...this.position };
  }
}
