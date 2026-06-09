// server/src/game/ServerMap.js
import { MAP_CONFIG } from '@dropzone/shared';

// Simplified heightmap using procedural generation (matches client-side terrain)
export class ServerMap {
  constructor() {
    this.seed = Math.floor(Math.random() * 999999);
    this.size = MAP_CONFIG.SIZE;
    this.gridSize = 128; // Resolution of height samples
    this.cellSize = this.size / this.gridSize;
    this.heights = null;
    this.generateHeightmap();
  }

  generateHeightmap() {
    this.heights = new Float32Array(this.gridSize * this.gridSize);

    // Use the same algorithm as client-side terrain generation
    for (let z = 0; z < this.gridSize; z++) {
      for (let x = 0; x < this.gridSize; x++) {
        const nx = x / this.gridSize - 0.5;
        const nz = z / this.gridSize - 0.5;

        let height = 0;
        height += this.noise(nx * 2, nz * 2, this.seed) * 40;
        height += this.noise(nx * 4, nz * 4, this.seed + 1) * 20;
        height += this.noise(nx * 8, nz * 8, this.seed + 2) * 10;
        height += this.noise(nx * 16, nz * 16, this.seed + 3) * 5;

        // Flatten near center (town area)
        const distFromCenter = Math.sqrt(nx * nx + nz * nz);
        if (distFromCenter < 0.12) {
          height = height * (distFromCenter / 0.12) * 0.3;
        }

        // Slightly raise edges (military base area)
        const edgeDist = Math.max(Math.abs(nx), Math.abs(nz));
        if (edgeDist > 0.4) {
          height += (edgeDist - 0.4) * 60;
        }

        this.heights[z * this.gridSize + x] = Math.max(-2, height);
      }
    }
  }

  noise(x, y, seed) {
    // Simple value noise
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;

    const a = this.hash(ix, iy, seed);
    const b = this.hash(ix + 1, iy, seed);
    const c = this.hash(ix, iy + 1, seed);
    const d = this.hash(ix + 1, iy + 1, seed);

    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);

    return lerp(lerp(a, b, ux), lerp(c, d, ux), uy);
  }

  hash(x, y, seed) {
    let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.2) * 43758.5453;
    n = n - Math.floor(n);
    return n * 2 - 1;
  }

  getHeightAt(worldX, worldZ) {
    // Convert world coordinates to grid coordinates
    const halfSize = this.size / 2;
    const gx = ((worldX + halfSize) / this.size) * this.gridSize;
    const gz = ((worldZ + halfSize) / this.size) * this.gridSize;

    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;

    const x0 = Math.max(0, Math.min(this.gridSize - 1, ix));
    const x1 = Math.max(0, Math.min(this.gridSize - 1, ix + 1));
    const z0 = Math.max(0, Math.min(this.gridSize - 1, iz));
    const z1 = Math.max(0, Math.min(this.gridSize - 1, iz + 1));

    const h00 = this.heights[z0 * this.gridSize + x0];
    const h10 = this.heights[z0 * this.gridSize + x1];
    const h01 = this.heights[z1 * this.gridSize + x0];
    const h11 = this.heights[z1 * this.gridSize + x1];

    const h0 = lerp(h00, h10, fx);
    const h1 = lerp(h01, h11, fx);
    return lerp(h0, h1, fz);
  }

  isInBounds(x, z) {
    const halfSize = this.size / 2;
    return x >= -halfSize && x <= halfSize && z >= -halfSize && z <= halfSize;
  }
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}
