// server/src/game/ServerPlayer.js
import {
  PLAYER_STATES, PLAYER_CONFIG, ITEMS, WEAPONS,
} from '@dropzone/shared';
import { clamp, Vec3 } from '@dropzone/shared';
import { PlayerInventory } from './PlayerInventory.js';

export class ServerPlayer {
  constructor(userId, username, user) {
    this.userId = userId;
    this.userDbId = user._id;
    this.username = username;

    // State
    this.state = PLAYER_STATES.IN_AIRPLANE;
    this.connected = true;

    // Transform
    this.position = { x: 0, y: PLAYER_CONFIG.PARACHUTE_DEPLOY_HEIGHT, z: 0 };
    this.velocity = { x: 0, y: 0, z: 0 };
    this.rotation = 0;  // yaw
    this.pitch = 0;

    // Physics
    this.isGrounded = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.isJumping = false;

    // Health
    this.health = PLAYER_CONFIG.MAX_HEALTH;
    this.armor = 0;
    this.boost = 0;

    // Parachute
    this.parachuteDeployed = false;
    this.isFalling = false;

    // Combat
    this.activeWeaponSlot = 0;
    this.weapons = [null, null, null]; // primary, secondary, melee/pistol
    this.inVehicle = null;
    this.vehicleSeat = -1;
    this.isADS = false;

    // Stats
    this.killCount = 0;
    this.killStreak = 0;
    this.damageDealt = 0;
    this.headshotCount = 0;
    this.timeAlive = 0;
    this.lastAliveCheck = Date.now();
    this.distanceTraveled = 0;
    this.lastPosition = { ...this.position };

    // Input
    this.lastInput = null;
    this.lastInputSeq = 0;
    this.lastInputTime = 0;

    // Inventory
    this.inventory = new PlayerInventory();

    // Spawn with default pistol
    this.weapons[2] = this.createWeaponInstance('PISTOL');
    this.activeWeaponSlot = 2;

    this.jumpQueueIndex = 0;
  }

  update(dt, map) {
    if (this.state === PLAYER_STATES.DEAD) return;

    // Track time alive
    if (this.state === PLAYER_STATES.ALIVE) {
      this.timeAlive = (Date.now() - this.lastAliveCheck) / 1000;

      // Track distance
      const moved = Vec3.distance(this.lastPosition, this.position);
      if (moved > 0.1) {
        this.distanceTraveled += moved;
        this.lastPosition = { ...this.position };
      }
    }

    if (this.state === PLAYER_STATES.PARACHUTING) {
      this.updateParachute(dt, map);
      return;
    }

    if (this.state !== PLAYER_STATES.ALIVE) return;

    // Apply gravity
    if (!this.isGrounded) {
      this.velocity.y += PLAYER_CONFIG.GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -50);
    }

    // Apply velocity
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground collision
    const groundHeight = map.getHeightAt(this.position.x, this.position.z);
    const playerBottom = this.position.y;

    if (playerBottom <= groundHeight) {
      this.position.y = groundHeight;
      if (this.velocity.y < -PLAYER_CONFIG.MAX_FALL_DAMAGE_SPEED) {
        const fallSpeed = Math.abs(this.velocity.y);
        const fallDamage = (fallSpeed - PLAYER_CONFIG.MAX_FALL_DAMAGE_SPEED) *
          PLAYER_CONFIG.FALL_DAMAGE_MULTIPLIER;
        this.health -= Math.min(Math.ceil(fallDamage), 90);
      }
      this.velocity.y = 0;
      this.isGrounded = true;
      this.isJumping = false;
    } else {
      this.isGrounded = false;
    }

    // Boost regen health
    if (this.boost > 0 && this.health < PLAYER_CONFIG.MAX_HEALTH) {
      this.health = Math.min(PLAYER_CONFIG.MAX_HEALTH, this.health + this.boost * dt * 0.5);
      this.boost = Math.max(0, this.boost - dt * 2);
    }

    // Damp horizontal velocity
    this.velocity.x *= 0.85;
    this.velocity.z *= 0.85;

    // Map bounds clamp
    const halfSize = MAP_CONFIG.SIZE / 2;
    this.position.x = clamp(this.position.x, -halfSize, halfSize);
    this.position.z = clamp(this.position.z, -halfSize, halfSize);
  }

  applyInput(input, dt, map) {
    if (this.state !== PLAYER_STATES.ALIVE) return;
    if (this.inVehicle) return; // Vehicle handles movement

    this.rotation = input.yaw;
    this.pitch = input.pitch;
    this.isADS = input.ads;
    this.isCrouching = input.crouch && this.isGrounded;
    this.isSprinting = input.sprint && !this.isCrouching && !input.ads;

    let speed = PLAYER_CONFIG.MOVE_SPEED;
    if (this.isSprinting) speed = PLAYER_CONFIG.SPRINT_SPEED;
    if (this.isCrouching) speed = PLAYER_CONFIG.CROUCH_SPEED;
    if (this.isADS) speed *= 0.7;

    const moveX = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const moveZ = (input.backward ? 1 : 0) - (input.forward ? 1 : 0);

    if (moveX !== 0 || moveZ !== 0) {
      const cos = Math.cos(this.rotation);
      const sin = Math.sin(this.rotation);
      const worldX = moveX * cos + moveZ * sin;
      const worldZ = -moveX * sin + moveZ * cos;
      const len = Math.sqrt(worldX * worldX + worldZ * worldZ);
      this.velocity.x = (worldX / len) * speed;
      this.velocity.z = (worldZ / len) * speed;
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
    }

    if (input.jump && this.isGrounded && !this.isCrouching) {
      this.velocity.y = PLAYER_CONFIG.JUMP_FORCE;
      this.isGrounded = false;
      this.isJumping = true;
    }
  }

  startParachuting(position) {
    this.state = PLAYER_STATES.PARACHUTING;
    this.position = { ...position };
    this.velocity = { x: 0, y: -PLAYER_CONFIG.FREE_FALL_SPEED, z: 0 };
    this.parachuteDeployed = false;
    this.isFalling = true;
  }

  deployParachute() {
    if (!this.isFalling) return;
    if (this.position.y > PLAYER_CONFIG.PARACHUTE_DEPLOY_HEIGHT) return;
    this.parachuteDeployed = true;
    this.velocity.y = -PLAYER_CONFIG.PARACHUTE_FALL_SPEED;
  }

  updateParachute(dt, map) {
    // Horizontal movement during parachute (via input)
    this.position.x += this.velocity.x * dt;
    this.position.z += this.velocity.z * dt;

    if (!this.parachuteDeployed && this.position.y <= PLAYER_CONFIG.PARACHUTE_DEPLOY_HEIGHT) {
      this.parachuteDeployed = true;
      this.velocity.y = -PLAYER_CONFIG.PARACHUTE_FALL_SPEED;
    }

    const fallSpeed = this.parachuteDeployed
      ? PLAYER_CONFIG.PARACHUTE_FALL_SPEED
      : PLAYER_CONFIG.FREE_FALL_SPEED;

    this.velocity.y = -fallSpeed;
    this.position.y += this.velocity.y * dt;

    // Check landing
    const groundHeight = map.getHeightAt(this.position.x, this.position.z);
    if (this.position.y <= groundHeight + 0.1) {
      this.position.y = groundHeight;
      this.velocity = { x: 0, y: 0, z: 0 };
      this.state = PLAYER_STATES.ALIVE;
      this.parachuteDeployed = false;
      this.isFalling = false;
      this.isGrounded = true;
      this.lastAliveCheck = Date.now();
      this.lastPosition = { ...this.position };
    }
  }

  getCurrentWeapon() {
    return this.weapons[this.activeWeaponSlot];
  }

  switchWeapon(slot) {
    if (slot < 0 || slot >= 3) return;
    if (!this.weapons[slot]) return;
    this.activeWeaponSlot = slot;
  }

  createWeaponInstance(weaponId) {
    const def = WEAPONS[weaponId];
    if (!def) return null;
    return {
      id: weaponId,
      ammo_in_mag: def.magazine_size,
      ammo_reserve: def.max_ammo - def.magazine_size,
      isReloading: false,
      lastFireTime: 0,
    };
  }

  startReload() {
    const weapon = this.getCurrentWeapon();
    if (!weapon) return false;
    if (weapon.isReloading) return false;
    if (weapon.ammo_in_mag === WEAPONS[weapon.id].magazine_size) return false;
    if (weapon.ammo_reserve <= 0) return false;
    weapon.isReloading = true;
    return true;
  }

  completeReload() {
    const weapon = this.getCurrentWeapon();
    if (!weapon || !weapon.isReloading) return 0;
    weapon.isReloading = false;
    const def = WEAPONS[weapon.id];
    const needed = def.magazine_size - weapon.ammo_in_mag;
    const toAdd = Math.min(needed, weapon.ammo_reserve);
    weapon.ammo_in_mag += toAdd;
    weapon.ammo_reserve -= toAdd;
    return toAdd;
  }

  useItem(itemType) {
    const item = this.inventory.getItem(itemType);
    if (!item) return null;

    switch (item.type) {
      case 'healing':
        if (this.health >= PLAYER_CONFIG.MAX_HEALTH) return null;
        if (item.max_hp && this.health >= item.max_hp) return null;
        this.health = Math.min(item.max_hp || PLAYER_CONFIG.MAX_HEALTH, this.health + item.heal_amount);
        break;
      case 'boost':
        this.boost = Math.min(100, this.boost + item.boost_amount);
        break;
      case 'armor':
        this.armor = Math.min(PLAYER_CONFIG.MAX_ARMOR, this.armor + item.armor_amount);
        break;
    }

    this.inventory.removeItem(itemType, null, 1);
    return { itemType, health: this.health, armor: this.armor, boost: this.boost };
  }

  getNetworkState() {
    return {
      id: this.userId,
      x: Math.round(this.position.x * 100) / 100,
      y: Math.round(this.position.y * 100) / 100,
      z: Math.round(this.position.z * 100) / 100,
      rot: Math.round(this.rotation * 1000) / 1000,
      pitch: Math.round(this.pitch * 1000) / 1000,
      state: this.state,
      health: this.health,
      armor: this.armor,
      anim: this.getAnimState(),
      weapon: this.getCurrentWeapon()?.id || null,
      inVehicle: this.inVehicle,
      seq: this.lastInputSeq,
    };
  }

  getAnimState() {
    if (this.state === PLAYER_STATES.PARACHUTING) return 'parachute';
    if (!this.isGrounded) return 'jump';
    if (this.isCrouching) {
      const moving = Math.abs(this.velocity.x) + Math.abs(this.velocity.z) > 0.5;
      return moving ? 'crouch_walk' : 'crouch_idle';
    }
    const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.z ** 2);
    if (speed > PLAYER_CONFIG.SPRINT_SPEED * 0.7) return 'sprint';
    if (speed > 0.5) return 'run';
    return 'idle';
  }

  serialize() {
    return {
      userId: this.userId,
      username: this.username,
      position: this.position,
      rotation: this.rotation,
      state: this.state,
      health: this.health,
      armor: this.armor,
      boost: this.boost,
      weapons: this.weapons.map(w => w ? { id: w.id, ammo: w.ammo_in_mag, reserve: w.ammo_reserve } : null),
      activeWeaponSlot: this.activeWeaponSlot,
      inventory: this.inventory.serialize(),
      killCount: this.killCount,
    };
  }
}
