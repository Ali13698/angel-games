import * as THREE from 'three';

export class Dice3D {
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private renderer!: THREE.WebGLRenderer;
  private cube!: THREE.Mesh;
  private animating = false;
  private targetRot: [number, number, number] = [0, 0, 0];
  private currentRot: [number, number, number] = [0.3, 0.5, 0];
  private initialized = false;

  constructor(private canvas: HTMLCanvasElement) {}

  async init() {
    if (this.initialized) return;
    const w = this.canvas.clientWidth || 200;
    const h = this.canvas.clientHeight || 200;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    this.camera.position.set(0, 0, 5);
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(w, h, false);
    const geo = new THREE.BoxGeometry(2, 2, 2);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.05 });
    this.cube = new THREE.Mesh(geo, mat);
    this.scene.add(this.cube);
    const l1 = new THREE.DirectionalLight(0xffffff, 1.2);
    l1.position.set(5, 5, 5);
    this.scene.add(l1);
    const l2 = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(l2);
    this.initialized = true;
    this.loop();
  }

  show() { this.canvas.style.display = 'block'; }
  hide() { this.canvas.style.display = 'none'; }

  async roll(die: number) {
    if (!this.initialized) await this.init();
    this.show();
    const faceRot: Record<number, [number, number, number]> = {
      1: [0, 0, 0],
      2: [0, Math.PI, 0],
      3: [0, -Math.PI / 2, 0],
      4: [0, Math.PI / 2, 0],
      5: [-Math.PI / 2, 0, 0],
      6: [Math.PI / 2, 0, 0]
    };
    const t = faceRot[die] || faceRot[1];
    this.targetRot = [t[0] + 4 * Math.PI, t[1] + 4 * Math.PI, t[2]];
    this.animating = true;
    setTimeout(() => { this.hide(); }, 1800);
  }

  private loop = () => {
    if (!this.initialized) return;
    if (this.animating) {
      const lp = (a: number, b: number, t: number) => a + (b - a) * t;
      this.currentRot[0] = lp(this.currentRot[0], this.targetRot[0], 0.08);
      this.currentRot[1] = lp(this.currentRot[1], this.targetRot[1], 0.08);
      this.currentRot[2] = lp(this.currentRot[2], this.targetRot[2], 0.08);
      this.cube.rotation.set(this.currentRot[0], this.currentRot[1], this.currentRot[2]);
      const d = Math.abs(this.currentRot[0] - this.targetRot[0]) + Math.abs(this.currentRot[1] - this.targetRot[1]);
      if (d < 0.01) {
        this.animating = false;
        this.currentRot = [this.targetRot[0], this.targetRot[1], this.targetRot[2]];
      }
    } else {
      this.cube.rotation.y += 0.008;
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.loop);
  };
}
