// client/src/core/Renderer.js
import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    // Detect device capability
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.quality = isMobile ? (pixelRatio > 1.5 ? 'medium' : 'low') : 'high';

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: this.quality === 'high',
      powerPreference: 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = this.quality !== 'low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.0008);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      2000
    );
    this.camera.position.set(0, 5, 10);

    // Lighting
    this.setupLighting();

    this.resize();
  }

  setupLighting() {
    // Ambient
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    // Sun
    const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
    sun.position.set(300, 600, 200);
    sun.castShadow = this.quality !== 'low';

    if (sun.castShadow) {
      sun.shadow.mapSize.width = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.mapSize.height = this.quality === 'high' ? 2048 : 1024;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 2000;
      sun.shadow.camera.left = -500;
      sun.shadow.camera.right = 500;
      sun.shadow.camera.top = 500;
      sun.shadow.camera.bottom = -500;
      sun.shadow.bias = -0.0005;
    }
    this.scene.add(sun);
    this.sun = sun;

    // Hemisphere (sky/ground)
    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c2f, 0.5);
    this.scene.add(hemi);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.renderer.dispose();
  }
}
