// client/src/systems/LootSystem.js
import * as THREE from 'three';
import { WEAPONS, ITEMS, AMMO_TYPES, LOOT_RARITY } from '@dropzone/shared';

const RARITY_COLORS = {
  common:   0xaaaaaa,
  uncommon: 0x44ee88,
  rare:     0x4488ff,
  epic:     0xcc44ff,
};

const BOB_SPEED = 2.0;
const BOB_HEIGHT = 0.15;
const PICKUP_DISTANCE = 3.5;
const LOD_DISTANCE_SQ = 150 * 150;

class LootItem {
  constructor(data, scene) {
    this.id = data.id;
    this.data = data;
    this.scene = scene;
    this.position = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    this.bobTime = Math.random() * Math.PI * 2;
    this.mesh = null;
    this.glow = null;
    this.baseY = data.position.y;

    this.build();
  }

  build() {
    const group = new THREE.Group();
    const rarity = this.data.rarity || LOOT_RARITY.COMMON;
    const color = RARITY_COLORS[rarity] || 0xaaaaaa;

    let geo;
    const category = this.data.category;

    if (category === 'weapon') {
      // Elongated box for weapons
      geo = new THREE.BoxGeometry(0.12, 0.1, 0.65);
    } else if (category === 'ammo') {
      geo = new THREE.BoxGeometry(0.18, 0.12, 0.18);
    } else if (category === 'item') {
      geo = new THREE.SphereGeometry(0.14, 6, 4);
    } else {
      geo = new THREE.OctahedronGeometry(0.16);
    }

    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = false;
    group.add(mesh);

    // Glow ring underneath
    const ringGeo = new THREE.RingGeometry(0.18, 0.22, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.y = -0.18;
    group.add(ring);
    this.ring = ring;
    this.ringMat = ringMat;

    group.position.copy(this.position);
    group.position.y = this.baseY + 0.4;

    this.mesh = group;
    this.scene.add(group);
  }

  update(dt, cameraPos) {
    if (!this.mesh) return;

    // LOD: only animate if close enough
    const distSq = cameraPos.distanceToSquared(this.mesh.position);
    if (distSq > LOD_DISTANCE_SQ) return;

    this.bobTime += dt * BOB_SPEED;
    this.mesh.position.y = this.baseY + 0.4 + Math.sin(this.bobTime) * BOB_HEIGHT;
    this.mesh.rotation.y += dt * 1.2;

    // Pulse ring
    const pulse = 0.4 + Math.sin(this.bobTime * 1.5) * 0.2;
    this.ringMat.opacity = pulse;
  }

  dispose() {
    if (!this.mesh) return;
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
    this.mesh = null;
  }
}

export class LootSystem {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map(); // id -> LootItem
    this._nearbyCache = [];
    this._nearbyCheckInterval = 0;
  }

  spawnItem(data) {
    if (!data || !data.id || !data.position) return;
    if (this.items.has(data.id)) return;
    const item = new LootItem(data, this.scene);
    this.items.set(data.id, item);
  }

  removeItem(itemId) {
    const item = this.items.get(itemId);
    if (item) {
      item.dispose();
      this.items.delete(itemId);
    }
  }

  update(dt) {
    // Get camera position for LOD
    const cam = window.__game?.renderer?.camera;
    const camPos = cam ? cam.position : new THREE.Vector3();

    for (const item of this.items.values()) {
      item.update(dt, camPos);
    }
  }

  checkProximity(playerPos, callback) {
    this._nearbyCheckInterval++;
    if (this._nearbyCheckInterval % 6 !== 0) return; // Check every 6 frames

    const pv3 = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    const nearby = [];

    for (const [id, item] of this.items.entries()) {
      if (!item.mesh) continue;
      const dist = pv3.distanceTo(item.mesh.position);
      if (dist <= PICKUP_DISTANCE) {
        nearby.push({
          id,
          data: item.data,
          dist,
        });
      }
    }

    nearby.sort((a, b) => a.dist - b.dist);
    callback(nearby.slice(0, 6)); // Show at most 6 nearby items
  }

  getNearbyItems(playerPos, maxDist) {
    const pv3 = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);
    const result = [];
    for (const [id, item] of this.items.entries()) {
      if (!item.mesh) continue;
      const dist = pv3.distanceTo(item.mesh.position);
      if (dist <= maxDist) {
        result.push({ id, data: item.data, dist });
      }
    }
    return result;
  }

  reset() {
    for (const item of this.items.values()) {
      item.dispose();
    }
    this.items.clear();
  }
}
