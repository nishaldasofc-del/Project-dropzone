// client/src/systems/WeaponSystem.js
import * as THREE from 'three';
import { WEAPONS } from '@dropzone/shared';

const TRACER_LIFETIME = 0.06; // seconds
const MUZZLE_LIFETIME = 0.05;

class BulletTracer {
  constructor(scene, origin, direction, range) {
    this.scene = scene;
    this.lifetime = TRACER_LIFETIME;

    const length = Math.min(range, 80);
    const geo = new THREE.CylinderGeometry(0.012, 0.012, length, 4);
    geo.rotateX(Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffee88,
      transparent: true,
      opacity: 0.85,
    });
    this.mesh = new THREE.Mesh(geo, mat);

    const end = new THREE.Vector3(
      origin.x + direction.x * length,
      origin.y + direction.y * length,
      origin.z + direction.z * length,
    );
    this.mesh.position.copy(origin).add(end).multiplyScalar(0.5);
    this.mesh.lookAt(end);

    // Tilt to align with direction
    const dir3 = new THREE.Vector3(direction.x, direction.y, direction.z).normalize();
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir3);
    this.mesh.position.set(
      (origin.x + end.x) / 2,
      (origin.y + end.y) / 2,
      (origin.z + end.z) / 2,
    );

    scene.add(this.mesh);
    this.mat = mat;
  }

  update(dt) {
    this.lifetime -= dt;
    const alpha = Math.max(0, this.lifetime / TRACER_LIFETIME);
    this.mat.opacity = alpha * 0.85;
    return this.lifetime > 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

class MuzzleFlash {
  constructor(scene, position) {
    this.scene = scene;
    this.lifetime = MUZZLE_LIFETIME;

    const geo = new THREE.SphereGeometry(0.18, 6, 4);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.9 });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.copy(position);
    scene.add(this.mesh);
    this.mat = mat;

    // Point light
    this.light = new THREE.PointLight(0xffaa00, 3, 8);
    this.light.position.copy(position);
    scene.add(this.light);
  }

  update(dt) {
    this.lifetime -= dt;
    const t = Math.max(0, this.lifetime / MUZZLE_LIFETIME);
    this.mat.opacity = t * 0.9;
    this.light.intensity = t * 3;
    this.mesh.scale.setScalar(1 + (1 - t) * 0.5);
    return this.lifetime > 0;
  }

  dispose() {
    this.scene.remove(this.mesh);
    this.scene.remove(this.light);
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }
}

class ImpactEffect {
  constructor(scene, position, isBlood) {
    this.scene = scene;
    this.lifetime = 0.15;

    // Sparks / blood particles
    const count = isBlood ? 6 : 8;
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      verts[i * 3] = position.x + (Math.random() - 0.5) * 0.3;
      verts[i * 3 + 1] = position.y + Math.random() * 0.3;
      verts[i * 3 + 2] = position.z + (Math.random() - 0.5) * 0.3;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    const mat = new THREE.PointsMaterial({
      color: isBlood ? 0xcc1111 : 0xddcc88,
      size: isBlood ? 0.1 : 0.06,
      transparent: true,
    });
    this.points = new THREE.Points(geo, mat);
    scene.add(this.points);
    this.mat = mat;

    // Decal plane
    const decalGeo = new THREE.PlaneGeometry(0.25, 0.25);
    const decalMat = new THREE.MeshBasicMaterial({
      color: isBlood ? 0x880000 : 0x444444,
      transparent: true, opacity: 0.7,
    });
    this.decal = new THREE.Mesh(decalGeo, decalMat);
    this.decal.position.copy(position);
    this.decal.position.y += 0.01;
    this.decal.rotation.x = -Math.PI / 2;
    scene.add(this.decal);
    this._decalMat = decalMat;
  }

  update(dt) {
    this.lifetime -= dt;
    const t = Math.max(0, this.lifetime / 0.15);
    this.mat.opacity = t;
    return this.lifetime > 0;
  }

  dispose() {
    this.scene.remove(this.points);
    this.scene.remove(this.decal);
    this.points.geometry.dispose();
    this.mat.dispose();
    this.decal.geometry.dispose();
    this._decalMat.dispose();
  }
}

// Weapon view model (first person arms + gun on camera)
class WeaponViewModel {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.group = new THREE.Group();
    this.currentWeaponId = null;
    this.recoilOffset = new THREE.Vector3();
    this.recoilRot = 0;
    this.swayOffset = new THREE.Vector3();

    camera.add(this.group);
    scene.add(camera); // Ensure camera is in scene
    this.buildGenericModel();
  }

  buildGenericModel() {
    // Generic gun shape, colored by weapon type
    const stockGeo = new THREE.BoxGeometry(0.04, 0.04, 0.35);
    const stockMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
    this.stock = new THREE.Mesh(stockGeo, stockMat);

    const gripGeo = new THREE.BoxGeometry(0.03, 0.1, 0.03);
    const grip = new THREE.Mesh(gripGeo, stockMat);
    grip.position.set(0, -0.055, -0.05);

    const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6);
    barrelGeo.rotateX(Math.PI / 2);
    const barrel = new THREE.Mesh(barrelGeo, stockMat);
    barrel.position.set(0, 0.01, -0.27);

    this.group.add(this.stock, grip, barrel);
    this.group.position.set(0.18, -0.16, -0.32);
    this.muzzlePoint = new THREE.Vector3(0, 0.01, -0.38);
  }

  setWeapon(weaponId) {
    if (this.currentWeaponId === weaponId) return;
    this.currentWeaponId = weaponId;

    const def = WEAPONS[weaponId];
    if (!def) return;

    // Color code by weapon type
    const colors = {
      assault_rifle: 0x333344,
      smg: 0x334433,
      shotgun: 0x443322,
      sniper: 0x222222,
      pistol: 0x2a2a2a,
    };
    const color = colors[def.type] || 0x333333;
    this.stock.material.color.setHex(color);

    // Scale by weapon class
    const scales = {
      assault_rifle: 1.0,
      smg: 0.85,
      shotgun: 1.1,
      sniper: 1.3,
      pistol: 0.7,
    };
    const s = scales[def.type] || 1.0;
    this.group.scale.setScalar(s);
  }

  getMuzzleWorldPosition() {
    const pos = new THREE.Vector3();
    this.group.localToWorld(pos.copy(this.muzzlePoint));
    return pos;
  }

  applyRecoil(vertical, horizontal) {
    this.recoilOffset.y += vertical * 0.04;
    this.recoilOffset.z += vertical * 0.025;
    this.recoilRot += vertical * 0.03;
    this.group.position.z += 0.02; // Kickback
  }

  update(dt, adsProgress) {
    // Recover from recoil
    this.recoilOffset.lerp(new THREE.Vector3(), dt * 12);
    this.recoilRot *= (1 - dt * 12);

    // ADS transition
    const adsPos = new THREE.Vector3(-0.01, -0.12, -0.28);
    const hipPos = new THREE.Vector3(0.18, -0.16, -0.32);
    const targetPos = hipPos.clone().lerp(adsPos, adsProgress);

    this.group.position.lerp(
      targetPos.clone().add(this.recoilOffset),
      dt * 15
    );
    this.group.rotation.x = this.recoilRot;
  }
}

export class WeaponSystem {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.tracers = [];
    this.flashes = [];
    this.impacts = [];
    this.viewModel = new WeaponViewModel(scene, camera);
  }

  showLocalFire(weaponId, position, direction) {
    this.viewModel.setWeapon(weaponId);
    const def = WEAPONS[weaponId];
    if (!def) return;

    // Muzzle flash at view model barrel
    const muzzlePos = this.viewModel.getMuzzleWorldPosition();
    this.flashes.push(new MuzzleFlash(this.scene, muzzlePos));

    // Bullet tracer
    const range = def.range_falloff_end * 1.2;
    this.tracers.push(new BulletTracer(this.scene, muzzlePos, direction, range));

    // Recoil on view model
    this.viewModel.applyRecoil(def.recoil_vertical, def.recoil_horizontal);
  }

  showRemoteFire(data) {
    const origin = new THREE.Vector3(data.origin.x, data.origin.y + 1.5, data.origin.z);
    const dir = new THREE.Vector3(data.direction.x, data.direction.y, data.direction.z).normalize();
    const def = WEAPONS[data.weaponId];
    const range = def ? def.range_falloff_end * 1.2 : 200;

    this.tracers.push(new BulletTracer(this.scene, origin, dir, range));
    this.flashes.push(new MuzzleFlash(this.scene, origin));

    // Hit effects
    for (const hit of (data.hits || [])) {
      if (hit.pos) {
        const isBlood = hit.type === 'player';
        this.impacts.push(new ImpactEffect(
          this.scene,
          new THREE.Vector3(hit.pos.x, hit.pos.y, hit.pos.z),
          isBlood
        ));
      }
    }
  }

  showWeaponSwitch(weaponId) {
    if (weaponId) this.viewModel.setWeapon(weaponId);
  }

  update(dt) {
    // Update tracers
    this.tracers = this.tracers.filter(t => {
      const alive = t.update(dt);
      if (!alive) t.dispose();
      return alive;
    });

    // Update muzzle flashes
    this.flashes = this.flashes.filter(f => {
      const alive = f.update(dt);
      if (!alive) f.dispose();
      return alive;
    });

    // Update impacts
    this.impacts = this.impacts.filter(i => {
      const alive = i.update(dt);
      if (!alive) i.dispose();
      return alive;
    });

    // Update view model
    const game = this.game;
    const adsProgress = window.__game?.player?.adsProgress || 0;
    this.viewModel.update(dt, adsProgress);
  }
}
