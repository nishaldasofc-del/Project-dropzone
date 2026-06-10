// client/src/core/PlayerController.js
import * as THREE from 'three';
import { PLAYER_CONFIG, PLAYER_STATES, NETWORK_EVENTS, WEAPONS } from '@dropzone/shared';
import { clamp, lerp } from '@dropzone/shared';

const CAMERA_DISTANCE = 5.5;
const CAMERA_HEIGHT = 2.2;
const CAMERA_SMOOTH = 12;
const MOUSE_SENSITIVITY = 0.002;
const TOUCH_SENSITIVITY = 0.008;

export class PlayerController {
  constructor(game) {
    this.game = game;
    this.scene = game.renderer.scene;
    this.camera = game.renderer.camera;
    this.input = game.input;
    this.network = game.network;

    // State
    this.state = PLAYER_STATES.IN_AIRPLANE;
    this.isAlive = false;
    this.inVehicle = null;
    this.vehicleSeat = -1;

    // Transform
    this.position = new THREE.Vector3(0, 600, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.isGrounded = false;
    this.isCrouching = false;
    this.isSprinting = false;
    this.parachuteDeployed = false;

    // Combat
    this.health = 100;
    this.armor = 0;
    this.boost = 0;
    this.weapons = [null, null, null];
    this.activeWeaponSlot = 0;
    this.lastFireTime = 0;
    this.isReloading = false;
    this.isADS = false;
    this.adsProgress = 0;

    // Stats
    this.killCount = 0;
    this.damageDealt = 0;
    this.headshotCount = 0;
    this.timeAlive = 0;
    this.matchStartTime = 0;
    this.inputSeq = 0;

    // Camera
    this.cameraTarget = new THREE.Vector3();
    this.cameraPos = new THREE.Vector3(0, 10, 10);
    this.cameraOffset = new THREE.Vector3(0.4, CAMERA_HEIGHT, CAMERA_DISTANCE);

    // Player mesh
    this.mesh = null;
    this.aimHelper = null;
    this.buildMesh();

    // Input events
    window.addEventListener('game:input', (e) => this.onInputEvent(e.detail));
  }

  buildMesh() {
    // Player body (capsule approximation)
    const bodyGeo = new THREE.CapsuleGeometry(PLAYER_CONFIG.RADIUS, PLAYER_CONFIG.HEIGHT - PLAYER_CONFIG.RADIUS * 2, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x2244aa });
    this.mesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.mesh.castShadow = true;
    this.mesh.visible = false; // Local player mesh hidden (third person camera shows it)

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xddbbaa });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.head.position.y = PLAYER_CONFIG.HEIGHT * 0.5 - 0.1;
    this.mesh.add(this.head);

    // Weapon placeholder
    const weaponGeo = new THREE.BoxGeometry(0.08, 0.08, 0.6);
    const weaponMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    this.weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
    this.weaponMesh.position.set(0.3, 0.3, -0.5);

    this.scene.add(this.mesh);

    // ADS scope overlay
    this.adsOverlay = document.createElement('div');
    this.adsOverlay.className = 'ads-overlay hidden';
    document.getElementById('hud').appendChild(this.adsOverlay);
  }

  enterAirplane() {
    this.state = PLAYER_STATES.IN_AIRPLANE;
    this.isAlive = false;
    this.matchStartTime = Date.now();
  }

  onInputEvent(detail) {
    const { name, data } = detail;
    switch (name) {
      case 'reload':
        this.requestReload();
        break;
      case 'interact':
        this.tryPickupLoot();
        break;
      case 'drop':
        this.dropCurrentWeapon();
        break;
      case 'weapon_slot':
        this.switchWeaponSlot(data);
        break;
      case 'weapon_scroll':
        this.scrollWeapon(data);
        break;
      case 'inventory':
        this.game.hud.toggleInventory();
        break;
      case 'map':
        this.game.hud.toggleMap();
        break;
      case 'escape':
        if (document.exitPointerLock) document.exitPointerLock();
        break;
    }
  }

  update(dt) {
    switch (this.state) {
      case PLAYER_STATES.IN_AIRPLANE:
        this.updateAirplaneCamera(dt);
        break;
      case PLAYER_STATES.PARACHUTING:
        this.updateParachute(dt);
        break;
      case PLAYER_STATES.ALIVE:
        this.updateAlive(dt);
        break;
      case PLAYER_STATES.DEAD:
        this.updateDeadCamera(dt);
        break;
    }
  }

  updateAirplaneCamera(dt) {
    // Camera follows airplane
    const airplane = this.game.world.airplane;
    if (!airplane) return;

    const targetPos = airplane.position.clone().add(new THREE.Vector3(5, -2, 10));
    this.camera.position.lerp(targetPos, dt * 3);
    this.camera.lookAt(airplane.position);
    this.camera.rotation.z = 0;

    // Listen for jump input
    const input = this.input.getGameInput();
    if (input.jump) {
      this.requestJump();
    }
  }

  requestJump() {
    this.network.emit(NETWORK_EVENTS.PLAYER_JUMP, {});
    this.state = PLAYER_STATES.PARACHUTING;
    this.isAlive = false;
    const airplane = this.game.world.airplane;
    if (airplane) {
      this.position.copy(airplane.position);
    }
    this.velocity.set(0, -PLAYER_CONFIG.FREE_FALL_SPEED, 0);
    this.mesh.visible = true;
    this.game.hud.showParachuteHUD(true);
  }

  updateParachute(dt) {
    // Camera rotation
    this.updateCameraRotation(dt);

    // Horizontal control during freefall
    const input = this.input.getGameInput();
    const joystick = this.input.getJoystickDelta();

    const hSpeed = this.parachuteDeployed ? PLAYER_CONFIG.PARACHUTE_FALL_SPEED * 0.4 : 5;
    const moveX = input.left ? -1 : input.right ? 1 : joystick.left.x;
    const moveZ = input.forward ? -1 : input.backward ? 1 : joystick.left.y;

    if (moveX !== 0 || moveZ !== 0) {
      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      this.velocity.x = (moveX * cos + moveZ * sin) * hSpeed;
      this.velocity.z = (-moveX * sin + moveZ * cos) * hSpeed;
    } else {
      this.velocity.x *= 0.9;
      this.velocity.z *= 0.9;
    }

    // Vertical
    const fallSpeed = this.parachuteDeployed ? PLAYER_CONFIG.PARACHUTE_FALL_SPEED : PLAYER_CONFIG.FREE_FALL_SPEED;
    this.velocity.y = -fallSpeed;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Auto deploy
    if (!this.parachuteDeployed && this.position.y <= PLAYER_CONFIG.PARACHUTE_DEPLOY_HEIGHT) {
      this.deployParachute();
    }

    // Deploy on input
    if (input.jump && !this.parachuteDeployed) {
      this.deployParachute();
    }

    // Landing
    const groundH = this.game.world.getHeightAt(this.position.x, this.position.z);
    if (this.position.y <= groundH + 0.1) {
      this.position.y = groundH;
      this.land();
    }

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.position.y += PLAYER_CONFIG.HEIGHT / 2;

    this.updateThirdPersonCamera(dt);
    this.game.hud.updateParachuteAltitude(this.position.y);
  }

  deployParachute() {
    if (this.parachuteDeployed) return;
    this.parachuteDeployed = true;
    this.network.emit(NETWORK_EVENTS.PLAYER_DEPLOY_PARACHUTE, {});
    this.game.hud.updateParachuteText('PARACHUTE');
    this.game.audio.playParachute();
  }

  land() {
    this.state = PLAYER_STATES.ALIVE;
    this.isAlive = true;
    this.parachuteDeployed = false;
    this.velocity.set(0, 0, 0);
    this.isGrounded = true;
    this.matchStartTime = Date.now();

    this.game.hud.showParachuteHUD(false);
    this.input.setGameMode(true);

    // On desktop, lock pointer
    if (!this.input.isMobile) {
      this.game.canvas.requestPointerLock?.();
    }
  }

  updateAlive(dt) {
    this.timeAlive = (Date.now() - this.matchStartTime) / 1000;

    // Camera rotation from input
    this.updateCameraRotation(dt);

    // Client-side prediction movement
    this.updateMovement(dt);

    // Firing
    const input = this.input.getGameInput();
    if (input.fire && !this.isReloading) {
      this.tryFire();
    }

    // ADS
    const adsTarget = input.ads ? 1 : 0;
    this.adsProgress = lerp(this.adsProgress, adsTarget, dt * 10);
    this.isADS = input.ads;

    if (this.isADS) {
      this.adsOverlay.classList.remove('hidden');
    } else {
      this.adsOverlay.classList.add('hidden');
    }

    // Camera
    this.updateThirdPersonCamera(dt);

    // Update mesh
    this.mesh.position.copy(this.position);
    this.mesh.position.y += PLAYER_CONFIG.HEIGHT / 2;
    this.mesh.rotation.y = this.yaw + Math.PI;
  }

  updateCameraRotation(dt) {
    if (this.input.isMobile) {
      const joystick = this.input.getJoystickDelta();
      if (this.input.rightJoystick.active) {
        this.yaw -= joystick.right.x * TOUCH_SENSITIVITY;
        this.pitch -= joystick.right.y * TOUCH_SENSITIVITY;
      }
    } else {
      const mouse = this.input.getMouseDelta();
      this.yaw -= mouse.dx * MOUSE_SENSITIVITY;
      this.pitch -= mouse.dy * MOUSE_SENSITIVITY;
    }
    this.pitch = clamp(this.pitch, -Math.PI * 0.4, Math.PI * 0.4);
  }

  updateMovement(dt) {
    const input = this.input.getGameInput();
    const joystick = this.input.getJoystickDelta();

    this.isCrouching = input.crouch && this.isGrounded;
    this.isSprinting = input.sprint && !this.isCrouching && !this.isADS;

    let speed = PLAYER_CONFIG.MOVE_SPEED;
    if (this.isSprinting) speed = PLAYER_CONFIG.SPRINT_SPEED;
    if (this.isCrouching) speed = PLAYER_CONFIG.CROUCH_SPEED;
    if (this.isADS) speed *= 0.7;

    let moveX = input.right ? 1 : input.left ? -1 : 0;
    let moveZ = input.backward ? 1 : input.forward ? -1 : 0;

    if (this.input.isMobile && this.input.leftJoystick.active) {
      moveX = this.input.leftJoystick.dx;
      moveZ = this.input.leftJoystick.dy;
    }

    if (moveX !== 0 || moveZ !== 0) {
      const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
      moveX /= len; moveZ /= len;

      const cos = Math.cos(this.yaw);
      const sin = Math.sin(this.yaw);
      this.velocity.x = (moveX * cos + moveZ * sin) * speed;
      this.velocity.z = (-moveX * sin + moveZ * cos) * speed;
    } else {
      this.velocity.x *= 0.8;
      this.velocity.z *= 0.8;
    }

    // Gravity
    if (!this.isGrounded) {
      this.velocity.y += PLAYER_CONFIG.GRAVITY * dt;
      this.velocity.y = Math.max(this.velocity.y, -50);
    }

    // Jump
    if (input.jump && this.isGrounded && !this.isCrouching) {
      this.velocity.y = PLAYER_CONFIG.JUMP_FORCE;
      this.isGrounded = false;
    }

    // Apply velocity
    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    // Ground check
    const groundH = this.game.world.getHeightAt(this.position.x, this.position.z);
    if (this.position.y <= groundH) {
      this.position.y = groundH;
      this.velocity.y = 0;
      this.isGrounded = true;
    } else {
      this.isGrounded = false;
    }

    // Map bounds
    const half = MAP_CONFIG.SIZE / 2;
    this.position.x = clamp(this.position.x, -half, half);
    this.position.z = clamp(this.position.z, -half, half);
  }

  updateThirdPersonCamera(dt) {
    // Calculate camera position behind player
    const camDist = this.isADS ? CAMERA_DISTANCE * 0.6 : CAMERA_DISTANCE;
    const camHeight = this.isCrouching ? CAMERA_HEIGHT * 0.7 : CAMERA_HEIGHT;

    const cosYaw = Math.cos(this.yaw);
    const sinYaw = Math.sin(this.yaw);
    const cosPitch = Math.cos(this.pitch);
    const sinPitch = Math.sin(this.pitch);

    const offsetX = sinYaw * camDist * cosPitch + 0.4 * cosYaw;
    const offsetY = camHeight - sinPitch * camDist;
    const offsetZ = cosYaw * camDist * cosPitch - 0.4 * sinYaw;

    const targetCamPos = new THREE.Vector3(
      this.position.x + offsetX,
      this.position.y + offsetY,
      this.position.z + offsetZ,
    );

    // Smooth camera
    this.camera.position.lerp(targetCamPos, dt * CAMERA_SMOOTH);

    // Look at player's head
    const lookAt = new THREE.Vector3(
      this.position.x,
      this.position.y + PLAYER_CONFIG.HEIGHT * 0.85,
      this.position.z,
    );
    this.camera.lookAt(lookAt);
    // Prevent Z-axis roll accumulation (gimbal lock on mobile during freefall)
    this.camera.rotation.z = 0;
  }

  updateDeadCamera(dt) {
    // Slowly pan around death position
    const t = Date.now() * 0.0005;
    const orbitR = 8;
    this.camera.position.set(
      this.position.x + Math.cos(t) * orbitR,
      this.position.y + 5,
      this.position.z + Math.sin(t) * orbitR,
    );
    this.camera.lookAt(this.position.x, this.position.y + 1, this.position.z);
  }

  // ============================================================
  // WEAPON ACTIONS
  // ============================================================

  tryFire() {
    const weapon = this.weapons[this.activeWeaponSlot];
    if (!weapon) return;
    if (this.isReloading) return;
    if (weapon.ammo_in_mag <= 0) {
      this.requestReload();
      return;
    }

    const weaponDef = WEAPONS[weapon.id];
    if (!weaponDef) return;

    const now = Date.now();
    const fireInterval = 60000 / weaponDef.fire_rate;
    if (now - this.lastFireTime < fireInterval) return;

    this.lastFireTime = now;

    // Client-side: visual fire immediately
    weapon.ammo_in_mag--;

    // Calculate fire direction
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);

    // Send to server
    this.network.emit(NETWORK_EVENTS.WEAPON_FIRE, {
      direction: { x: direction.x, y: direction.y, z: direction.z },
      timestamp: now,
    });

    // Visual effects
    this.game.weapons.showLocalFire(weapon.id, this.position, direction);
    this.game.hud.updateWeaponHUD(this);

    // Recoil
    this.applyRecoil(weaponDef);

    // Auto weapon - hold fire
    if (weaponDef.auto && this.input.getGameInput().fire) {
      // Will fire next frame if fire_rate allows
    }
  }

  applyRecoil(weaponDef) {
    this.pitch += weaponDef.recoil_vertical * 0.012;
    this.yaw += (Math.random() - 0.5) * weaponDef.recoil_horizontal * 0.008;
    this.pitch = clamp(this.pitch, -Math.PI * 0.4, Math.PI * 0.4);
  }

  requestReload() {
    const weapon = this.weapons[this.activeWeaponSlot];
    if (!weapon) return;
    if (this.isReloading) return;
    if (weapon.ammo_reserve <= 0) return;
    if (weapon.ammo_in_mag === WEAPONS[weapon.id]?.magazine_size) return;

    this.isReloading = true;
    this.network.emit(NETWORK_EVENTS.WEAPON_RELOAD, {});

    const reloadTime = WEAPONS[weapon.id]?.reload_time || 2000;
    this.game.hud.showReloading(reloadTime);
    this.game.audio.playReload(weapon.id);

    setTimeout(() => {
      this.isReloading = false;
    }, reloadTime);
  }

  switchWeaponSlot(slot) {
    if (slot < 0 || slot >= 3) return;
    if (!this.weapons[slot]) return;
    if (this.isReloading) return;
    this.activeWeaponSlot = slot;
    this.isReloading = false;
    this.network.emit(NETWORK_EVENTS.WEAPON_SWITCH, { slot });
    this.game.hud.updateWeaponHUD(this);
    this.game.weapons.showWeaponSwitch(this.weapons[slot]?.id);
  }

  scrollWeapon(dir) {
    let next = this.activeWeaponSlot + dir;
    // Find next occupied slot
    for (let i = 0; i < 3; i++) {
      next = ((next % 3) + 3) % 3;
      if (this.weapons[next]) {
        this.switchWeaponSlot(next);
        return;
      }
      next += dir;
    }
  }

  tryPickupLoot() {
    const nearby = this.game.loot.getNearbyItems(this.position, 3.0);
    if (nearby.length === 0) return;
    // Pickup closest
    const closest = nearby.sort((a, b) => a.dist - b.dist)[0];
    this.network.emit(NETWORK_EVENTS.ITEM_PICKUP, { itemId: closest.id });
  }

  dropCurrentWeapon() {
    const weapon = this.weapons[this.activeWeaponSlot];
    if (!weapon) return;
    this.network.emit(NETWORK_EVENTS.ITEM_DROP, {
      itemType: weapon.id,
      slot: this.activeWeaponSlot,
    });
  }

  onInventoryUpdate(data) {
    if (data.type === 'ammo' || data.type === 'reload_complete') {
      const weapon = this.weapons[data.weaponSlot];
      if (weapon) {
        weapon.ammo_in_mag = data.ammo_in_mag;
        weapon.ammo_reserve = data.ammo_reserve;
      }
    }

    if (data.type === 'item_picked_up' && data.weapon) {
      const slot = data.slot ?? this.findEmptyWeaponSlot();
      this.weapons[slot] = {
        id: data.weapon.type,
        ammo_in_mag: data.weapon.ammo_in_mag || WEAPONS[data.weapon.type]?.magazine_size || 0,
        ammo_reserve: data.weapon.ammo_reserve || 0,
      };
    }

    this.game.hud.updateWeaponHUD(this);
  }

  findEmptyWeaponSlot() {
    for (let i = 0; i < 3; i++) {
      if (!this.weapons[i]) return i;
    }
    return this.activeWeaponSlot; // Replace current
  }

  // Server reconciliation
  applyServerReconciliation(serverState) {
    const posDiff = this.position.distanceTo(
      new THREE.Vector3(serverState.x, serverState.y, serverState.z)
    );

    // If server position diverges too much, snap to server
    if (posDiff > 3.0) {
      this.position.set(serverState.x, serverState.y, serverState.z);
    } else if (posDiff > 0.1) {
      // Smooth correction
      this.position.lerp(
        new THREE.Vector3(serverState.x, serverState.y, serverState.z),
        0.3
      );
    }

    this.health = serverState.health;
    this.armor = serverState.armor;
    this.state = serverState.state;
  }

  die() {
    this.state = PLAYER_STATES.DEAD;
    this.isAlive = false;
    this.isReloading = false;
  }

  onEnterVehicle(vehicleId, seat) {
    this.inVehicle = vehicleId;
    this.vehicleSeat = seat;
  }

  onExitVehicle() {
    this.inVehicle = null;
    this.vehicleSeat = -1;
  }

  reset() {
    this.state = PLAYER_STATES.IN_AIRPLANE;
    this.isAlive = false;
    this.position.set(0, 600, 0);
    this.velocity.set(0, 0, 0);
    this.yaw = 0; this.pitch = 0;
    this.health = 100; this.armor = 0; this.boost = 0;
    this.weapons = [null, null, null];
    this.activeWeaponSlot = 0;
    this.isReloading = false;
    this.parachuteDeployed = false;
    this.inVehicle = null;
    this.killCount = 0;
    this.damageDealt = 0;
    this.inputSeq = 0;
    this.mesh.visible = false;
    this.adsOverlay.classList.add('hidden');
    this.input.setGameMode(false);
  }

  get currentWeapon() {
    return this.weapons[this.activeWeaponSlot];
  }
}

const MAP_CONFIG = { SIZE: 4096 };
