// client/src/core/Renderer.js
import * as THREE from 'three';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;

    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
    this.quality = isMobile ? 'low' : 'high'; // force low on ALL mobile

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,           // OFF — big perf win on mobile
      powerPreference: isMobile ? 'low-power' : 'high-performance',
      alpha: false,
      stencil: false,
      depth: true,
    });

    this.renderer.setPixelRatio(isMobile ? 1 : pixelRatio); // no retina on mobile
    this.renderer.shadowMap.enabled = false;                 // shadows OFF always
    this.renderer.toneMapping = THREE.NoToneMapping;         // skip tone mapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = isMobile ? null : new THREE.FogExp2(0x87ceeb, 0.0008); // no fog on mobile

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      isMobile ? 1000 : 2000  // shorter draw distance on mobile
    );
    this.camera.position.set(0, 5, 10);

    this.setupLighting();
    this.resize();
  }

  setupLighting() {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6); // brighter ambient, no need for sun shadows
    this.scene.add(ambient);

    const sun = new THREE.DirectionalLight(0xfff5e0, 1.0);
    sun.position.set(300, 600, 200);
    sun.castShadow = false; // always off
    this.scene.add(sun);
    this.sun = sun;

    const hemi = new THREE.HemisphereLight(0x87ceeb, 0x4a7c2f, 0.4);
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
