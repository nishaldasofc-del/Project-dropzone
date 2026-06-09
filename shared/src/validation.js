// shared/src/validation.js
// Server-side validation to prevent cheating

import { PLAYER_CONFIG, GAME_CONFIG } from './constants.js';
import { Vec3 } from './math.js';

const MAX_POSITION_DELTA_PER_TICK = (PLAYER_CONFIG.SPRINT_SPEED * 1.3) / GAME_CONFIG.TICK_RATE;
const MAX_TELEPORT_DIST_SQ = 100 * 100; // 100 units max per frame before flagging

export function validatePlayerMovement(prevPos, newPos, deltaTime, playerState) {
  if (!prevPos || !newPos) return false;

  const dist = Vec3.distance(prevPos, newPos);
  const maxAllowed = PLAYER_CONFIG.SPRINT_SPEED * deltaTime * 1.5; // 50% tolerance

  if (dist > maxAllowed + 5) {
    return false; // Teleport detected
  }

  return true;
}

export function validateFireRate(weapon, lastFireTime, currentTime) {
  if (!lastFireTime) return true;
  const minInterval = 60000 / weapon.fire_rate;
  const elapsed = currentTime - lastFireTime;
  return elapsed >= minInterval * 0.85; // 15% tolerance for latency
}

export function validateAmmo(currentAmmo, shotCount) {
  return currentAmmo >= shotCount;
}

export function validateItemPickup(playerPos, itemPos, maxDistance = 3.0) {
  return Vec3.distance(playerPos, itemPos) <= maxDistance;
}

export function validateVehicleState(prevState, newState, deltaTime) {
  if (!prevState) return true;
  const dist = Vec3.distance(prevState.position, newState.position);
  const maxSpeed = 35; // slightly above motorcycle max speed
  const maxAllowed = maxSpeed * deltaTime * 1.5;
  return dist <= maxAllowed + 5;
}

export function sanitizeInput(input) {
  return {
    forward:  !!input.forward,
    backward: !!input.backward,
    left:     !!input.left,
    right:    !!input.right,
    jump:     !!input.jump,
    crouch:   !!input.crouch,
    sprint:   !!input.sprint,
    fire:     !!input.fire,
    ads:      !!input.ads,
    yaw:      typeof input.yaw === 'number' ? Math.max(-Math.PI * 2, Math.min(Math.PI * 2, input.yaw)) : 0,
    pitch:    typeof input.pitch === 'number' ? Math.max(-Math.PI / 2, Math.min(Math.PI / 2, input.pitch)) : 0,
    seq:      typeof input.seq === 'number' ? Math.floor(input.seq) : 0,
    timestamp: typeof input.timestamp === 'number' ? input.timestamp : Date.now(),
  };
}

export function validateDamage(damage, maxDamage) {
  return typeof damage === 'number' && damage > 0 && damage <= maxDamage;
}
