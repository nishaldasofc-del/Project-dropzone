// client/src/core/World.js
import * as THREE from 'three';
import { MAP_CONFIG, PLAYER_CONFIG } from '@dropzone/shared';

const TERRAIN_SEGMENTS = 128;

export class World {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.terrain = null;
    this.airplane = null;
    this.airplanePath = null;
    this.airplaneProgress = 0;
    this.buildings = [];
    this.trees = [];
    this.rocks = [];
    this.seed = 0;

    // Object pools
    this.impactPool = [];
    this.trailPool = [];

    this.setupSkybox();
    this.setupWater();
  }

  async buildMap(seed) {
    this.seed = seed;
    this.clearMap();

    this.buildTerrain(seed);
    this.buildLocations();
    this.buildVegetation(seed);
    this.buildRocks(seed);
    this.buildRoads();
  }

  buildTerrain(seed) {
    const size = MAP_CONFIG.SIZE;
    const segs = TERRAIN_SEGMENTS;

    const geometry = new THREE.PlaneGeometry(size, size, segs, segs);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position.array;

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const z = positions[i + 2];
      positions[i + 1] = this.getHeight(x, z, seed);
    }

    geometry.computeVertexNormals();
    geometry.computeBoundingBox();

    // Terrain texture (vertex colors for biomes)
    const colors = new Float32Array(positions.length);
    for (let i = 0; i < positions.length; i += 3) {
      const y = positions[i + 1];
      let r, g, b;
      if (y > 60) { r = 0.6; g = 0.6; b = 0.6; }        // Rock
      else if (y > 30) { r = 0.55; g = 0.45; b = 0.3; }  // Mountain dirt
      else if (y > 0) { r = 0.25; g = 0.45; b = 0.2; }   // Grass
      else if (y > -2) { r = 0.8; g = 0.75; b = 0.55; }  // Beach sand
      else { r = 0.2; g = 0.35; b = 0.5; }               // Water bed
      colors[i] = r; colors[i + 1] = g; colors[i + 2] = b;
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshLambertMaterial({
      vertexColors: true,
      side: THREE.FrontSide,
    });

    this.terrain = new THREE.Mesh(geometry, material);
    this.terrain.receiveShadow = true;
    this.terrain.castShadow = false;
    this.scene.add(this.terrain);

    // Cache height data for client-side checks
    this._heightSeed = seed;
  }

  getHeight(x, z, seed) {
    const nx = x / MAP_CONFIG.SIZE;
    const nz = z / MAP_CONFIG.SIZE;

    let h = 0;
    h += this.noise(nx * 2, nz * 2, seed) * 40;
    h += this.noise(nx * 4, nz * 4, seed + 1) * 20;
    h += this.noise(nx * 8, nz * 8, seed + 2) * 10;
    h += this.noise(nx * 16, nz * 16, seed + 3) * 5;

    const distFromCenter = Math.sqrt(nx * nx + nz * nz);
    if (distFromCenter < 0.12) {
      h = h * (distFromCenter / 0.12) * 0.3;
    }

    const edgeDist = Math.max(Math.abs(nx), Math.abs(nz));
    if (edgeDist > 0.4) h += (edgeDist - 0.4) * 60;

    return Math.max(-2, h);
  }

  noise(x, y, seed) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const a = this.hash(ix, iy, seed), b = this.hash(ix + 1, iy, seed);
    const c = this.hash(ix, iy + 1, seed), d = this.hash(ix + 1, iy + 1, seed);
    const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
    return (a + (b - a) * ux) + ((c - a) + (a - b - c + d) * ux) * uy;
  }

  hash(x, y, seed) {
    let n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.2) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  getHeightAt(x, z) {
    return this.getHeight(x, z, this._heightSeed || 0);
  }

  buildLocations() {
    // Central Town
    this.buildTown(0, 0, 200, 12);
    // Military Base
    this.buildMilitaryBase(1500, 1500);
    // Factory
    this.buildFactory(-1200, 800);
    // Villages
    this.buildVillage(800, -900, 5);
    this.buildVillage(-700, -1100, 4);
    // Small outposts
    this.buildOutpost(600, 600);
    this.buildOutpost(-600, 400);
    this.buildOutpost(1000, -200);
  }

  buildTown(cx, cz, radius, buildingCount) {
    // Roads
    this.addRoad(cx - radius, cz, cx + radius, cz, 8);
    this.addRoad(cx, cz - radius, cx, cz + radius, 8);

    // Buildings arranged in a grid
    const spacing = 40;
    for (let i = 0; i < buildingCount; i++) {
      const angle = (i / buildingCount) * Math.PI * 2;
      const r = 40 + Math.random() * 120;
      const bx = cx + Math.cos(angle) * r;
      const bz = cz + Math.sin(angle) * r;
      const w = 8 + Math.random() * 12;
      const d = 8 + Math.random() * 12;
      const h = 5 + Math.random() * 15;
      this.addBuilding(bx, bz, w, h, d);
    }
  }

  buildMilitaryBase(cx, cz) {
    // Perimeter fence (simplified as low walls)
    const size = 250;
    this.addBuilding(cx - size/2, cz, 4, 3, size, 0x556644); // Left wall
    this.addBuilding(cx + size/2, cz, 4, 3, size, 0x556644); // Right wall
    this.addBuilding(cx, cz - size/2, size, 3, 4, 0x556644); // Front wall
    this.addBuilding(cx, cz + size/2, size, 3, 4, 0x556644); // Back wall

    // Barracks
    for (let i = 0; i < 4; i++) {
      this.addBuilding(cx - 80 + i * 50, cz - 80, 20, 4, 40, 0x667755);
    }
    // Hangars
    this.addBuilding(cx + 60, cz + 60, 60, 8, 30, 0x556644);
    this.addBuilding(cx - 60, cz + 60, 60, 8, 30, 0x556644);
    // Tower
    this.addBuilding(cx, cz, 6, 20, 6, 0x445533);
  }

  buildFactory(cx, cz) {
    this.addBuilding(cx, cz, 80, 15, 50, 0x775544);
    this.addBuilding(cx + 50, cz - 20, 40, 20, 40, 0x665533);
    this.addBuilding(cx - 50, cz + 30, 30, 10, 60, 0x665533);
    // Chimney
    const chimneyGeo = new THREE.CylinderGeometry(2, 3, 30, 8);
    const chimneyMat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const chimney = new THREE.Mesh(chimneyGeo, chimneyMat);
    chimney.position.set(cx + 15, this.getHeightAt(cx + 15, cz) + 15, cz);
    chimney.castShadow = true;
    this.scene.add(chimney);
    this.buildings.push(chimney);
  }

  buildVillage(cx, cz, count) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const r = 20 + Math.random() * 40;
      const bx = cx + Math.cos(angle) * r;
      const bz = cz + Math.sin(angle) * r;
      this.addBuilding(bx, bz, 8 + Math.random() * 6, 4 + Math.random() * 3, 8 + Math.random() * 6);
    }
  }

  buildOutpost(cx, cz) {
    this.addBuilding(cx, cz, 15, 5, 15);
    this.addBuilding(cx + 20, cz + 20, 10, 4, 10);
  }

  addBuilding(cx, cz, width, height, depth, color = 0xccbbaa) {
    const y = this.getHeightAt(cx, cz);
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(cx, y + height / 2, cz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // Add roof variation
    if (Math.random() > 0.5) {
      const roofGeo = new THREE.ConeGeometry(Math.max(width, depth) * 0.7, height * 0.3, 4);
      const roofMat = new THREE.MeshLambertMaterial({ color: 0x883322 });
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(cx, y + height + height * 0.15, cz);
      roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      this.scene.add(roof);
      this.buildings.push(roof);
    }

    this.scene.add(mesh);
    this.buildings.push(mesh);
    return mesh;
  }

  addRoad(x1, z1, x2, z2, width) {
    const dx = x2 - x1, dz = z2 - z1;
    const len = Math.sqrt(dx * dx + dz * dz);
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0x444444 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set((x1 + x2) / 2, 0.05, (z1 + z2) / 2);
    mesh.rotation.y = Math.atan2(dx, dz);
    mesh.receiveShadow = true;
    this.scene.add(mesh);
  }

  buildVegetation(seed) {
    const treePositions = [
      { x: 300, z: 1000, count: 80 },
      { x: -400, z: 1200, count: 60 },
      { x: 600, z: 800, count: 40 },
      { x: -300, z: 600, count: 50 },
      { x: 1000, z: -500, count: 30 },
    ];

    for (const cluster of treePositions) {
      for (let i = 0; i < cluster.count; i++) {
        const tx = cluster.x + (Math.random() - 0.5) * 300;
        const tz = cluster.z + (Math.random() - 0.5) * 300;
        const ty = this.getHeightAt(tx, tz);
        if (ty > 0 && ty < 50) {
          this.addTree(tx, ty, tz);
        }
      }
    }

    // Scatter trees everywhere
    for (let i = 0; i < 200; i++) {
      const tx = (Math.random() - 0.5) * MAP_CONFIG.SIZE * 0.9;
      const tz = (Math.random() - 0.5) * MAP_CONFIG.SIZE * 0.9;
      const ty = this.getHeightAt(tx, tz);
      const distCenter = Math.sqrt(tx * tx + tz * tz);
      if (ty > 1 && ty < 60 && distCenter > 150) {
        this.addTree(tx, ty, tz);
      }
    }
  }

  addTree(x, y, z) {
    const h = 4 + Math.random() * 6;
    const trunkGeo = new THREE.CylinderGeometry(0.2, 0.35, h * 0.4, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5c3a1e });
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, y + h * 0.2, z);
    trunk.castShadow = true;

    const foliageH = h * 0.7;
    const foliageGeo = new THREE.ConeGeometry(h * 0.35, foliageH, 6);
    const foliageMat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.15 + Math.random() * 0.1, 0.4 + Math.random() * 0.15, 0.1),
    });
    const foliage = new THREE.Mesh(foliageGeo, foliageMat);
    foliage.position.set(x, y + h * 0.4 + foliageH / 2, z);
    foliage.castShadow = true;

    this.scene.add(trunk);
    this.scene.add(foliage);
    this.trees.push(trunk, foliage);
  }

  buildRocks(seed) {
    for (let i = 0; i < 300; i++) {
      const rx = (Math.random() - 0.5) * MAP_CONFIG.SIZE * 0.9;
      const rz = (Math.random() - 0.5) * MAP_CONFIG.SIZE * 0.9;
      const ry = this.getHeightAt(rx, rz);
      if (ry > 2) {
        const size = 0.5 + Math.random() * 3;
        const geo = new THREE.DodecahedronGeometry(size, 0);
        const mat = new THREE.MeshLambertMaterial({ color: 0x888888 });
        const rock = new THREE.Mesh(geo, mat);
        rock.position.set(rx, ry + size * 0.4, rz);
        rock.rotation.set(Math.random(), Math.random(), Math.random());
        rock.castShadow = true;
        rock.receiveShadow = true;
        this.scene.add(rock);
        this.rocks.push(rock);
      }
    }
  }

  buildRoads() {
    // Main roads connecting locations
    this.addRoad(0, 0, 1500, 1500, 10);    // Town to Military
    this.addRoad(0, 0, -1200, 800, 8);     // Town to Factory
    this.addRoad(0, 0, 800, -900, 8);      // Town to Village 1
    this.addRoad(0, 0, -700, -1100, 8);    // Town to Village 2
  }

  setupSkybox() {
    // Gradient sky using a large sphere
    const skyGeo = new THREE.SphereGeometry(1800, 32, 16);
    skyGeo.scale(-1, 1, 1);

    const skyMat = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: new THREE.Color(0x1a3a6e) },
        bottomColor: { value: new THREE.Color(0x87ceeb) },
        offset: { value: 400 },
        exponent: { value: 0.6 },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float offset;
        uniform float exponent;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition + offset).y;
          gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    this.sky = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.sky);
  }

  setupWater() {
    const waterGeo = new THREE.PlaneGeometry(MAP_CONFIG.SIZE * 1.1, MAP_CONFIG.SIZE * 1.1);
    waterGeo.rotateX(-Math.PI / 2);
    const waterMat = new THREE.MeshLambertMaterial({
      color: 0x2266aa,
      transparent: true,
      opacity: 0.85,
    });
    this.water = new THREE.Mesh(waterGeo, waterMat);
    this.water.position.y = -1.5;
    this.scene.add(this.water);
  }

  setupAirplane(pathData) {
    // Airplane mesh
    const bodyGeo = new THREE.CylinderGeometry(1.2, 0.8, 12, 8);
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x888899 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.rotation.z = Math.PI / 2;

    const wingGeo = new THREE.BoxGeometry(18, 0.4, 4);
    const wingMat = new THREE.MeshLambertMaterial({ color: 0x777788 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.z = 1;

    const tailGeo = new THREE.BoxGeometry(6, 0.3, 2);
    const tail = new THREE.Mesh(tailGeo, wingMat);
    tail.position.x = -5;
    tail.position.y = 1;

    const airplaneGroup = new THREE.Group();
    airplaneGroup.add(body, wings, tail);
    airplaneGroup.position.set(
      pathData.startPos.x,
      pathData.altitude,
      pathData.startPos.z
    );

    this.airplane = airplaneGroup;
    this.airplanePath = pathData;
    this.airplaneProgress = 0;
    this.scene.add(airplaneGroup);
  }

  updateAirplane(state) {
    if (!this.airplane) return;
    this.airplane.position.set(state.x, state.y, state.z);
    this.airplaneProgress = state.progress;

    // Orient airplane along path
    if (this.airplanePath) {
      const dx = this.airplanePath.endPos.x - this.airplanePath.startPos.x;
      const dz = this.airplanePath.endPos.z - this.airplanePath.startPos.z;
      this.airplane.rotation.y = Math.atan2(dx, dz);
    }
  }

  spawnImpactEffect(position, type = 'bullet') {
    const geo = new THREE.SphereGeometry(0.15, 6, 6);
    const mat = new THREE.MeshBasicMaterial({ color: type === 'blood' ? 0xcc2222 : 0xddcc88 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(position);
    this.scene.add(mesh);
    setTimeout(() => {
      this.scene.remove(mesh);
      geo.dispose();
      mat.dispose();
    }, 2000);
  }

  update(dt) {
    if (this.water) {
      this.water.position.y = -1.5 + Math.sin(Date.now() * 0.001) * 0.1;
    }
    if (this.sky) {
      this.sky.position.copy(this.scene.camera?.position || new THREE.Vector3());
    }
  }

  clearMap() {
    for (const obj of [...this.buildings, ...this.trees, ...this.rocks]) {
      this.scene.remove(obj);
      obj.geometry?.dispose();
    }
    this.buildings = [];
    this.trees = [];
    this.rocks = [];
    if (this.terrain) {
      this.scene.remove(this.terrain);
      this.terrain.geometry.dispose();
      this.terrain = null;
    }
    if (this.airplane) {
      this.scene.remove(this.airplane);
      this.airplane = null;
    }
  }

  reset() {
    this.clearMap();
  }
}
