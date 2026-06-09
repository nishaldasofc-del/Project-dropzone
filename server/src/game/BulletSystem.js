// server/src/game/BulletSystem.js
import { WEAPONS, PLAYER_CONFIG } from '@dropzone/shared';
import { Vec3 } from '@dropzone/shared';

export class BulletSystem {
  constructor(map, players) {
    this.map = map;
    this.players = players;
    this.activeBullets = []; // For projectile-based bullets
  }

  // Process an instantaneous bullet (hitscan)
  processBullet(shooterId, weapon, origin, direction, timestamp, match) {
    const weaponDef = WEAPONS[weapon.id];
    if (!weaponDef) return [];

    const hits = [];
    const pellets = weaponDef.pellets || 1;

    for (let p = 0; p < pellets; p++) {
      // Apply spread
      const spread = weapon.isADS ? weaponDef.spread_ads : weaponDef.spread_base;
      const dir = this.applySpread(direction, spread);

      const hit = this.raycast(shooterId, origin, dir, weaponDef, timestamp, match);
      if (hit) hits.push(hit);
    }

    return hits;
  }

  applySpread(direction, spread) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(1 - Math.random() * spread * 500);
    const sinPhi = Math.sin(phi);

    // Perpendicular vectors
    const up = { x: 0, y: 1, z: 0 };
    let right = {
      x: direction.y * up.z - direction.z * up.y,
      y: direction.z * up.x - direction.x * up.z,
      z: direction.x * up.y - direction.y * up.x,
    };
    const rLen = Math.sqrt(right.x ** 2 + right.y ** 2 + right.z ** 2);
    if (rLen < 0.001) {
      right = { x: 1, y: 0, z: 0 };
    } else {
      right.x /= rLen; right.y /= rLen; right.z /= rLen;
    }

    const spreadX = (Math.cos(theta) * sinPhi);
    const spreadY = (Math.sin(theta) * sinPhi);

    return {
      x: direction.x + right.x * spreadX,
      y: direction.y + spreadY,
      z: direction.z + right.z * spreadX,
    };
  }

  raycast(shooterId, origin, direction, weaponDef, timestamp, match) {
    const MAX_RANGE = weaponDef.range_falloff_end * 1.5;

    // Normalize direction
    const len = Math.sqrt(direction.x ** 2 + direction.y ** 2 + direction.z ** 2);
    if (len === 0) return null;
    const dir = {
      x: direction.x / len,
      y: direction.y / len,
      z: direction.z / len,
    };

    let closestHit = null;
    let closestDist = MAX_RANGE;

    // Check all players using lag-compensated positions
    for (const [targetId, target] of this.players.entries()) {
      if (targetId === shooterId) continue;
      if (target.state !== 'alive') continue;

      // Get historical position for lag compensation
      const targetPos = match.getHistoricalPosition(targetId, timestamp);
      if (!targetPos) continue;

      // Sphere intersection test
      const toTarget = {
        x: targetPos.x - origin.x,
        y: (targetPos.y + PLAYER_CONFIG.HEIGHT * 0.5) - origin.y,
        z: targetPos.z - origin.z,
      };

      const tca = toTarget.x * dir.x + toTarget.y * dir.y + toTarget.z * dir.z;
      if (tca < 0) continue;

      const d2 = (toTarget.x ** 2 + toTarget.y ** 2 + toTarget.z ** 2) - tca * tca;
      const radius = PLAYER_CONFIG.RADIUS + 0.1;

      if (d2 > radius ** 2) continue;

      const thc = Math.sqrt(radius ** 2 - d2);
      const dist = tca - thc;

      if (dist > 0 && dist < closestDist) {
        closestDist = dist;

        // Determine headshot (hit in upper 20% of body)
        const hitY = origin.y + dir.y * dist;
        const headY = targetPos.y + PLAYER_CONFIG.HEIGHT * 0.85;
        const isHeadshot = hitY >= headY - 0.15;

        // Range damage falloff
        let damage = weaponDef.damage;
        if (dist > weaponDef.range_falloff_start) {
          const falloffRange = weaponDef.range_falloff_end - weaponDef.range_falloff_start;
          const falloffProgress = (dist - weaponDef.range_falloff_start) / falloffRange;
          damage = Math.max(damage * 0.1, damage * (1 - falloffProgress * 0.9));
        }

        closestHit = {
          type: 'player',
          targetId,
          damage: Math.ceil(damage),
          isHeadshot,
          weaponId: weaponDef.id,
          position: {
            x: origin.x + dir.x * dist,
            y: origin.y + dir.y * dist,
            z: origin.z + dir.z * dist,
          },
          distance: dist,
        };
      }
    }

    // TODO: Check terrain and building collisions (simplified here)
    const terrainHit = this.checkTerrainHit(origin, dir, closestDist);
    if (terrainHit && terrainHit.distance < closestDist) {
      return {
        type: 'terrain',
        position: terrainHit.position,
        distance: terrainHit.distance,
      };
    }

    return closestHit;
  }

  checkTerrainHit(origin, dir, maxDist) {
    // Step along ray and check ground
    const steps = 20;
    const stepSize = maxDist / steps;
    for (let i = 1; i <= steps; i++) {
      const t = i * stepSize;
      const px = origin.x + dir.x * t;
      const py = origin.y + dir.y * t;
      const pz = origin.z + dir.z * t;
      const groundY = this.map.getHeightAt(px, pz);
      if (py <= groundY) {
        return {
          position: { x: px, y: groundY, z: pz },
          distance: t,
        };
      }
    }
    return null;
  }

  update(dt) {
    // Process any projectile bullets (not needed for hitscan, kept for future)
    this.activeBullets = this.activeBullets.filter(b => {
      b.lifetime -= dt;
      return b.lifetime > 0;
    });
  }
}
