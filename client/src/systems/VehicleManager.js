// client/src/systems/VehicleManager.js
import * as THREE from 'three';
import { VEHICLES } from '@dropzone/shared';

class VehicleMesh {
  constructor(data, scene) {
    this.id = data.id;
    this.type = data.type;
    this.scene = scene;
    this.mesh = null;
    this.health = data.health || VEHICLES[data.type]?.max_health;
    this.maxHealth = data.maxHealth || this.health;
    this.destroyed = false;

    this.targetPos = new THREE.Vector3(data.position.x, data.position.y, data.position.z);
    this.targetRot = data.rotation || 0;
    this.currentPos = this.targetPos.clone();
    this.currentRot = this.targetRot;

    this.buildMesh(data);
  }

  buildMesh(data) {
    const def = VEHICLES[this.type];
    const group = new THREE.Group();

    if (this.type === 'JEEP') {
      this.buildJeep(group, def);
    } else if (this.type === 'MOTORCYCLE') {
      this.buildMotorcycle(group, def);
    }

    group.position.copy(this.targetPos);
    group.rotation.y = this.targetRot;
    group.castShadow = true;

    this.mesh = group;
    this.scene.add(group);
  }

  buildJeep(group, def) {
    // Body
    const bodyGeo = new THREE.BoxGeometry(def.width, def.height * 0.55, def.length);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x556644 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = def.height * 0.4;
    body.castShadow = true;

    // Cabin
    const cabinGeo = new THREE.BoxGeometry(def.width * 0.8, def.height * 0.45, def.length * 0.55);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.y = def.height * 0.78;
    cabin.position.z = def.length * 0.05;

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.25, 12);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    const wheelPositions = [
      [def.width / 2 + 0.1, 0.4, def.length * 0.33],
      [-def.width / 2 - 0.1, 0.4, def.length * 0.33],
      [def.width / 2 + 0.1, 0.4, -def.length * 0.33],
      [-def.width / 2 - 0.1, 0.4, -def.length * 0.33],
    ];
    this.wheels = [];
    for (const [wx, wy, wz] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(wx, wy, wz);
      group.add(wheel);
      this.wheels.push(wheel);
    }

    group.add(body, cabin);
  }

  buildMotorcycle(group, def) {
    // Frame
    const frameGeo = new THREE.BoxGeometry(0.2, 0.7, def.length * 0.8);
    const frameMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
    const frame = new THREE.Mesh(frameGeo, frameMat);
    frame.position.y = 0.8;

    // Tank
    const tankGeo = new THREE.BoxGeometry(0.35, 0.25, 0.4);
    const tankMat = new THREE.MeshLambertMaterial({ color: 0xcc2200 });
    const tank = new THREE.Mesh(tankGeo, tankMat);
    tank.position.set(0, 1.0, 0.1);

    // Wheels
    const wheelGeo = new THREE.TorusGeometry(0.35, 0.09, 8, 16);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    this.frontWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.frontWheel.position.set(0, 0.35, def.length * 0.4);
    this.frontWheel.rotation.y = Math.PI / 2;

    this.rearWheel = new THREE.Mesh(wheelGeo, wheelMat);
    this.rearWheel.position.set(0, 0.35, -def.length * 0.4);
    this.rearWheel.rotation.y = Math.PI / 2;

    this.wheels = [this.frontWheel, this.rearWheel];
    group.add(frame, tank, this.frontWheel, this.rearWheel);
  }

  update(dt, serverState) {
    if (serverState) {
      this.targetPos.set(serverState.x, serverState.y, serverState.z);
      this.targetRot = serverState.rot;
      this.health = serverState.health;
      this.destroyed = serverState.destroyed;
    }

    // Interpolate position
    this.currentPos.lerp(this.targetPos, dt * 12);
    this.mesh.position.copy(this.currentPos);

    // Interpolate rotation
    let rotDiff = this.targetRot - this.currentRot;
    while (rotDiff > Math.PI) rotDiff -= Math.PI * 2;
    while (rotDiff < -Math.PI) rotDiff += Math.PI * 2;
    this.currentRot += rotDiff * dt * 12;
    this.mesh.rotation.y = this.currentRot;

    // Spin wheels based on speed
    if (serverState?.speed && this.wheels) {
      const wheelSpin = serverState.speed * dt * 2;
      for (const wheel of this.wheels) {
        wheel.rotation.x += wheelSpin;
      }
    }

    // Sway motorcycle
    if (this.type === 'MOTORCYCLE' && serverState?.speed > 2) {
      this.mesh.rotation.z = Math.sin(Date.now() * 0.005) * 0.03;
    }

    // Destroy visual
    if (this.destroyed && !this._destroyEffectPlayed) {
      this._destroyEffectPlayed = true;
      this.playDestroyEffect();
    }
  }

  playDestroyEffect() {
    // Turn vehicle dark/burnt
    this.mesh.traverse(child => {
      if (child.material) {
        child.material = child.material.clone();
        child.material.color.setHex(0x222222);
      }
    });
    // Tilt slightly
    this.mesh.rotation.z = 0.3;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.traverse(child => {
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    });
  }
}

export class VehicleManager {
  constructor(scene) {
    this.scene = scene;
    this.vehicles = new Map(); // id -> VehicleMesh
  }

  spawnVehicle(data) {
    if (this.vehicles.has(data.id)) return;
    const v = new VehicleMesh(data, this.scene);
    this.vehicles.set(data.id, v);
  }

  updateVehicles(states) {
    if (!Array.isArray(states)) return;
    for (const state of states) {
      const v = this.vehicles.get(state.id);
      if (v) v.update(0.016, state);
    }
  }

  onPlayerEnter(data) {
    // Could highlight vehicle seat here
  }

  onPlayerExit(data) {
    // Nothing needed
  }

  getVehicle(id) {
    return this.vehicles.get(id);
  }

  update(dt) {
    for (const v of this.vehicles.values()) {
      v.update(dt, null);
    }
  }

  reset() {
    for (const v of this.vehicles.values()) {
      v.dispose();
    }
    this.vehicles.clear();
  }
}
