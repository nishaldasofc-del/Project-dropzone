// client/src/ui/MinimapRenderer.js
import { MAP_CONFIG } from '@dropzone/shared';

const MINIMAP_SIZE = 180;
const FULL_MAP_SIZE = 600;

export class MinimapRenderer {
  constructor(game) {
    this.game = game;
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas?.getContext('2d');
    this.scale = MINIMAP_SIZE / MAP_CONFIG.SIZE;
    this.updateInterval = 0;
    this._terrainCache = null;
  }

  worldToMinimap(wx, wz) {
    const half = MAP_CONFIG.SIZE / 2;
    const x = ((wx + half) / MAP_CONFIG.SIZE) * MINIMAP_SIZE;
    const y = ((wz + half) / MAP_CONFIG.SIZE) * MINIMAP_SIZE;
    return { x, y };
  }

  worldToMap(wx, wz, mapSize) {
    const half = MAP_CONFIG.SIZE / 2;
    const x = ((wx + half) / MAP_CONFIG.SIZE) * mapSize;
    const y = ((wz + half) / MAP_CONFIG.SIZE) * mapSize;
    return { x, y };
  }

  update() {
    this.updateInterval++;
    if (this.updateInterval % 3 !== 0) return; // Every 3 frames
    if (!this.ctx) return;
    this.drawMinimap();
  }

  drawMinimap() {
    const ctx = this.ctx;
    const size = MINIMAP_SIZE;
    ctx.clearRect(0, 0, size, size);

    // Background
    ctx.fillStyle = '#1a2a1a';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.clip();

    // Terrain colors (simplified from height)
    this.drawTerrainMinimap(ctx, size);

    // Safe zone
    this.drawZoneMinimap(ctx, size);

    // Loot (dots)
    this.drawLootMinimap(ctx, size);

    // Remote players
    this.drawRemotePlayersMinimap(ctx, size);

    // Local player (center with rotation indicator)
    this.drawLocalPlayerMinimap(ctx, size);

    ctx.restore();

    // Border
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.stroke();
  }

  drawTerrainMinimap(ctx, size) {
    // Simple grid-based terrain coloring
    const world = this.game.world;
    if (!world) return;

    const samples = 32;
    const cellSize = size / samples;
    const half = MAP_CONFIG.SIZE / 2;

    for (let zi = 0; zi < samples; zi++) {
      for (let xi = 0; xi < samples; xi++) {
        const wx = -half + (xi / samples) * MAP_CONFIG.SIZE;
        const wz = -half + (zi / samples) * MAP_CONFIG.SIZE;
        const h = world.getHeightAt(wx, wz);

        let color;
        if (h > 50) color = '#888';
        else if (h > 20) color = '#665533';
        else if (h > 0) color = '#2d5a1b';
        else if (h > -1) color = '#d4c87a';
        else color = '#1a3a5c';

        ctx.fillStyle = color;
        ctx.fillRect(xi * cellSize, zi * cellSize, cellSize + 1, cellSize + 1);
      }
    }
  }

  drawZoneMinimap(ctx, size) {
    const zoneState = this.game.zone?.zoneState;
    if (!zoneState) return;

    const dz = zoneState.displayZone || zoneState.safeZone;
    if (!dz) return;

    const pos = this.worldToMinimap(dz.x, dz.z);
    const r = (dz.radius / MAP_CONFIG.SIZE) * size;

    // Safe zone circle
    ctx.strokeStyle = 'rgba(0,170,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Next zone (white)
    const nz = zoneState.nextZone;
    if (nz && zoneState.isShrinking) {
      const npos = this.worldToMinimap(nz.x, nz.z);
      const nr = (nz.radius / MAP_CONFIG.SIZE) * size;
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(npos.x, npos.y, nr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  drawLootMinimap(ctx, size) {
    const lootSystem = this.game.loot;
    if (!lootSystem) return;

    ctx.fillStyle = 'rgba(255,220,80,0.7)';
    for (const [id, item] of lootSystem.items.entries()) {
      if (!item.data) continue;
      const pos = this.worldToMinimap(item.data.position.x, item.data.position.z);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawRemotePlayersMinimap(ctx, size) {
    const remotePlayers = this.game.remotePlayers;
    if (!remotePlayers) return;

    ctx.fillStyle = '#ff4444';
    for (const [id, player] of remotePlayers.players.entries()) {
      if (!player.mesh || !player.mesh.visible) continue;
      const pos = this.worldToMinimap(player.mesh.position.x, player.mesh.position.z);
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawLocalPlayerMinimap(ctx, size) {
    const player = this.game.player;
    if (!player || !player.isAlive) return;

    const pos = this.worldToMinimap(player.position.x, player.position.z);

    // Player dot
    ctx.fillStyle = '#ffd84a';
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    ctx.strokeStyle = '#ffd84a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(
      pos.x + Math.sin(player.yaw) * 8,
      pos.y + Math.cos(player.yaw) * 8,
    );
    ctx.stroke();
  }

  // Full map for map overlay
  renderFullMap(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = FULL_MAP_SIZE;
    ctx.clearRect(0, 0, size, size);

    const world = this.game.world;
    if (!world) return;

    // Terrain
    const samples = 64;
    const cellSize = size / samples;
    const half = MAP_CONFIG.SIZE / 2;

    for (let zi = 0; zi < samples; zi++) {
      for (let xi = 0; xi < samples; xi++) {
        const wx = -half + (xi / samples) * MAP_CONFIG.SIZE;
        const wz = -half + (zi / samples) * MAP_CONFIG.SIZE;
        const h = world.getHeightAt(wx, wz);

        let color;
        if (h > 60) color = '#999';
        else if (h > 30) color = '#776644';
        else if (h > 5) color = '#3a7022';
        else if (h > -1) color = '#d4c87a';
        else color = '#1a4060';

        ctx.fillStyle = color;
        ctx.fillRect(xi * cellSize, zi * cellSize, cellSize + 1, cellSize + 1);
      }
    }

    // Location labels
    const locations = [
      { name: 'CENTRAL TOWN', x: 0, z: 0 },
      { name: 'MILITARY BASE', x: 1500, z: 1500 },
      { name: 'FACTORY', x: -1200, z: 800 },
      { name: 'VILLAGE', x: 800, z: -900 },
      { name: 'VILLAGE', x: -700, z: -1100 },
    ];

    ctx.font = 'bold 9px Rajdhani, sans-serif';
    ctx.textAlign = 'center';
    for (const loc of locations) {
      const pos = this.worldToMap(loc.x, loc.z, size);
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.fillText(loc.name, pos.x, pos.y);
    }

    // Zone
    const zoneState = this.game.zone?.zoneState;
    if (zoneState?.displayZone) {
      const dz = zoneState.displayZone;
      const pos = this.worldToMap(dz.x, dz.z, size);
      const r = (dz.radius / MAP_CONFIG.SIZE) * size;
      ctx.strokeStyle = 'rgba(0,170,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // All players
    for (const [id, player] of (this.game.remotePlayers?.players || new Map()).entries()) {
      if (!player.mesh) continue;
      const pos = this.worldToMap(player.mesh.position.x, player.mesh.position.z, size);
      ctx.fillStyle = '#ff4444';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Local player
    const localPlayer = this.game.player;
    if (localPlayer?.isAlive) {
      const pos = this.worldToMap(localPlayer.position.x, localPlayer.position.z, size);
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.lineTo(
        pos.x + Math.sin(localPlayer.yaw) * 16,
        pos.y + Math.cos(localPlayer.yaw) * 16,
      );
      ctx.stroke();
    }
  }
}
