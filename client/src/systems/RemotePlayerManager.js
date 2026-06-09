// client/src/systems/RemotePlayerManager.js
import * as THREE from 'three';
import { PLAYER_CONFIG, PLAYER_STATES } from '@dropzone/shared';

const INTERPOLATION_DELAY = 100; // ms
const INTERP_SPEED = 15;

class RemotePlayer {
  constructor(id, scene) {
    this.id = id;
    this.scene = scene;
    this.stateBuffer = []; // { timestamp, x, y, z, rot, pitch, state, anim }
    this.currentState = null;
    this.mesh = null;
    this.nameTag = null;
    this.animState = 'idle';
    this.animTime = 0;
    this.bobOffset = 0;
    this.isVisible = true;

    this.buildMesh();
  }

  buildMesh() {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.CapsuleGeometry(PLAYER_CONFIG.RADIUS, PLAYER_CONFIG.HEIGHT - PLAYER_CONFIG.RADIUS * 2, 4, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xaa2222 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.castShadow = true;

    // Head
    const headGeo = new THREE.SphereGeometry(0.22, 8, 6);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xddbbaa });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = PLAYER_CONFIG.HEIGHT * 0.5 - 0.1;
    head.castShadow = true;

    // Weapon placeholder
    const weaponGeo = new THREE.BoxGeometry(0.08, 0.08, 0.6);
    const weaponMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    this.weaponMesh = new THREE.Mesh(weaponGeo, weaponMat);
    this.weaponMesh.position.set(0.3, 0.25, -0.4);

    group.add(body, head, this.weaponMesh);
    group.position.set(0, 0, 0);

    this.mesh = group;
    this.scene.add(group);
  }

  addState(state) {
    this.stateBuffer.push({
      timestamp: Date.now(),
      serverTimestamp: state.timestamp || Date.now(),
      x: state.x, y: state.y, z: state.z,
      rot: state.rot,
      pitch: state.pitch || 0,
      playerState: state.state,
      anim: state.anim || 'idle',
      weapon: state.weapon,
    });

    // Keep buffer trimmed to ~1 second
    const cutoff = Date.now() - 1000;
    this.stateBuffer = this.stateBuffer.filter(s => s.timestamp > cutoff);
  }

  update(dt) {
    if (this.stateBuffer.length < 1) return;

    const renderTime = Date.now() - INTERPOLATION_DELAY;

    // Find the two states to interpolate between
    let older = null;
    let newer = null;

    for (let i = 0; i < this.stateBuffer.length - 1; i++) {
      if (this.stateBuffer[i].timestamp <= renderTime && this.stateBuffer[i + 1].timestamp >= renderTime) {
        older = this.stateBuffer[i];
        newer = this.stateBuffer[i + 1];
        break;
      }
    }

    // Extrapolate if no pair found
    if (!older && this.stateBuffer.length > 0) {
      newer = this.stateBuffer[this.stateBuffer.length - 1];
      older = newer;
    }

    if (!newer) return;

    let t = 0;
    if (older !== newer) {
      const span = newer.timestamp - older.timestamp;
      t = span > 0 ? (renderTime - older.timestamp) / span : 1;
      t = Math.max(0, Math.min(1, t));
    }

    const ix = older.x + (newer.x - older.x) * t;
    const iy = older.y + (newer.y - older.y) * t;
    const iz = older.z + (newer.z - older.z) * t;

    // Lerp rotation (handle wrap-around)
    let rotDiff = newer.rot - older.rot;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    const iRot = older.rot + rotDiff * t;

    this.mesh.position.set(ix, iy + PLAYER_CONFIG.HEIGHT / 2, iz);
    this.mesh.rotation.y = iRot + Math.PI;

    // Animation
    this.animState = newer.anim;
    this.animTime += dt;
    this.applyAnimation(dt, newer.anim, newer.playerState);

    // Update weapon visibility
    if (newer.weapon !== this._lastWeapon) {
      this._lastWeapon = newer.weapon;
      this.weaponMesh.visible = !!newer.weapon;
    }

    // Hide dead players
    if (newer.playerState === PLAYER_STATES.DEAD) {
      this.mesh.visible = false;
    }
  }

  applyAnimation(dt, animState, playerState) {
    if (playerState === PLAYER_STATES.PARACHUTING) {
      // Arms out
      this.mesh.rotation.z = Math.sin(this.animTime * 2) * 0.05;
      return;
    }

    switch (animState) {
      case 'run':
      case 'sprint':
        this.bobOffset = Math.sin(this.animTime * 10) * 0.08;
        this.mesh.rotation.z = Math.sin(this.animTime * 10) * 0.03;
        break;
      case 'crouch_walk':
        this.bobOffset = Math.sin(this.animTime * 7) * 0.04;
        this.mesh.position.y -= 0.3;
        break;
      case 'crouch_idle':
        this.mesh.position.y -= 0.35;
        break;
      case 'jump':
        this.bobOffset = 0;
        break;
      default: // idle
        this.bobOffset = Math.sin(this.animTime * 1.5) * 0.01;
        this.mesh.rotation.z = 0;
        break;
    }
  }

  playReloadAnimation() {
    // Brief visual shake
    const origY = this.weaponMesh.position.y;
    this.weaponMesh.position.y -= 0.1;
    setTimeout(() => { this.weaponMesh.position.y = origY; }, 200);
  }

  onDeath() {
    this.mesh.visible = false;
    // Drop to ground slowly
    const fallInterval = setInterval(() => {
      this.mesh.rotation.z += 0.05;
      if (this.mesh.rotation.z >= Math.PI / 2) clearInterval(fallInterval);
    }, 16);
  }

  onJump(position) {
    this.mesh.position.set(
      position.x,
      position.y + PLAYER_CONFIG.HEIGHT / 2,
      position.z
    );
    this.mesh.visible = true;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

export class RemotePlayerManager {
  constructor(scene) {
    this.scene = scene;
    this.players = new Map(); // id -> RemotePlayer
  }

  updatePlayer(state) {
    if (!this.players.has(state.id)) {
      const rp = new RemotePlayer(state.id, this.scene);
      this.players.set(state.id, rp);
    }
    this.players.get(state.id).addState(state);
  }

  update(dt) {
    for (const player of this.players.values()) {
      player.update(dt);
    }
  }

  onPlayerDeath(playerId) {
    const player = this.players.get(playerId);
    if (player) player.onDeath();
  }

  onPlayerJump(playerId, position) {
    const player = this.players.get(playerId);
    if (player) player.onJump(position);
  }

  playReloadAnimation(playerId) {
    const player = this.players.get(playerId);
    if (player) player.playReloadAnimation();
  }

  removePlayer(playerId) {
    const player = this.players.get(playerId);
    if (player) {
      player.dispose();
      this.players.delete(playerId);
    }
  }

  reset() {
    for (const player of this.players.values()) {
      player.dispose();
    }
    this.players.clear();
  }
}
