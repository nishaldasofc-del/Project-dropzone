// client/src/systems/ZoneRenderer.js
import * as THREE from 'three';

const ZONE_WALL_HEIGHT = 200;
const ZONE_SEGMENTS = 128;

export class ZoneRenderer {
  constructor(scene) {
    this.scene = scene;
    this.safeZone = null;       // Current safe zone circle (blue)
    this.nextZone = null;       // Next zone (white dashed)
    this.displayZone = null;    // Animated shrinking zone
    this.zoneState = null;

    this.safeWall = null;
    this.nextWall = null;
    this.groundRing = null;

    this.time = 0;
  }

  updateZone(state) {
    this.zoneState = state;
    this.rebuildZoneVisuals(state);
  }

  rebuildZoneVisuals(state) {
    // Remove old meshes
    this.clearVisuals();

    const dz = state.displayZone || state.safeZone;
    const nz = state.nextZone || state.safeZone;

    // Safe zone wall (blue translucent cylinder)
    this.safeWall = this.createZoneWall(
      dz.x, dz.z, dz.radius,
      new THREE.Color(0x0088ff), 0.15, ZONE_WALL_HEIGHT
    );

    // Ground ring (solid ring showing safe zone boundary)
    this.groundRing = this.createGroundRing(dz.x, dz.z, dz.radius, 0x00aaff, 0.9);

    // Next zone indicator (white)
    if (state.isShrinking && nz.radius < dz.radius * 0.98) {
      this.nextWall = this.createZoneWall(
        nz.x, nz.z, nz.radius,
        new THREE.Color(0xffffff), 0.08, ZONE_WALL_HEIGHT
      );
      this.nextGroundRing = this.createGroundRing(nz.x, nz.z, nz.radius, 0xffffff, 0.6);
    }

    // Danger zone overlay (red outside safe zone) — fullscreen cylinder outside
    this.dangerWall = this.createDangerZone(dz.x, dz.z, dz.radius);
  }

  createZoneWall(cx, cz, radius, color, opacity, height) {
    // Cylinder wall
    const geo = new THREE.CylinderGeometry(radius, radius, height, ZONE_SEGMENTS, 1, true);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, height / 2 - 2, cz);
    this.scene.add(mesh);
    return { mesh, mat };
  }

  createGroundRing(cx, cz, radius, color, opacity) {
    const innerR = radius - 0.8;
    const outerR = radius + 0.8;
    const geo = new THREE.RingGeometry(innerR, outerR, ZONE_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0.15, cz);
    this.scene.add(mesh);
    return { mesh, mat };
  }

  createDangerZone(cx, cz, radius) {
    // Red tint outside safe zone (large outer wall)
    const outerR = 3000;
    // Create annulus between safeZone radius and map edge
    const geo = new THREE.RingGeometry(radius + 1, outerR, ZONE_SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0.08,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, 0.1, cz);
    this.scene.add(mesh);
    return { mesh, mat };
  }

  update(dt) {
    this.time += dt;

    if (!this.zoneState) return;

    // Animate zone wall (pulse opacity)
    if (this.safeWall) {
      const pulse = 0.12 + Math.sin(this.time * 2) * 0.04;
      this.safeWall.mat.opacity = pulse;
    }

    // Smoothly move display zone if shrinking
    if (this.zoneState.isShrinking && this.safeWall) {
      const dz = this.zoneState.displayZone;
      if (dz) {
        this.safeWall.mesh.position.set(dz.x, ZONE_WALL_HEIGHT / 2 - 2, dz.z);
        this.safeWall.mesh.scale.setScalar(1); // CylinderGeometry scaled by radius
        if (this.groundRing) {
          this.groundRing.mesh.position.set(dz.x, 0.15, dz.z);
        }
        if (this.dangerWall) {
          this.dangerWall.mesh.position.set(dz.x, 0.1, dz.z);
        }
      }
    }

    // Pulse next zone indicator
    if (this.nextWall) {
      this.nextWall.mat.opacity = 0.05 + Math.abs(Math.sin(this.time * 3)) * 0.06;
    }
  }

  clearVisuals() {
    const toRemove = [
      this.safeWall, this.nextWall, this.groundRing,
      this.nextGroundRing, this.dangerWall,
    ];
    for (const obj of toRemove) {
      if (obj) {
        this.scene.remove(obj.mesh);
        obj.mesh.geometry.dispose();
        obj.mat.dispose();
      }
    }
    this.safeWall = null;
    this.nextWall = null;
    this.groundRing = null;
    this.nextGroundRing = null;
    this.dangerWall = null;
  }

  reset() {
    this.clearVisuals();
    this.zoneState = null;
    this.time = 0;
  }
}
