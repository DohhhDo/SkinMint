import {
  ACESFilmicToneMapping,
  AnimationMixer,
  Box3,
  Clock,
  Color,
  PerspectiveCamera,
  PMREMGenerator,
  Scene,
  Sphere,
  WebGLRenderer,
  type AnimationAction,
  type AnimationClip,
} from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Draco decoder served from a stable CORS-enabled CDN. */
const DRACO_DECODER_PATH = "https://www.gstatic.com/draco/versioned/decoders/1.5.7/";

const TEMPLATE = `
<style>
  :host { display: block; width: 100%; height: 360px; position: relative; }
  .canvas-wrap { width: 100%; height: 100%; }
  canvas { display: block; width: 100% !important; height: 100% !important; outline: none; touch-action: none; }
  .status {
    position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
    font: 13px/1.4 system-ui, -apple-system, sans-serif; color: #94a3b8; pointer-events: none;
    text-align: center; padding: 12px;
  }
  .status[hidden] { display: none; }
</style>
<div class="canvas-wrap"></div>
<div class="status">loading…</div>
`;

export class SkinMintModel extends HTMLElement {
  static get observedAttributes() {
    return ["src", "background", "auto-rotate", "rotate-speed", "exposure", "environment", "animation"];
  }

  private renderer?: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(45, 1, 0.1, 1000);
  private controls?: OrbitControls;
  private statusEl!: HTMLDivElement;
  private wrap!: HTMLDivElement;
  private resizeObserver?: ResizeObserver;
  private frame = 0;
  private currentSrc = "";
  private loadToken = 0;
  private modelRoot?: import("three").Object3D;
  private clock = new Clock();
  private mixer?: AnimationMixer;
  private clips: AnimationClip[] = [];
  private currentAction?: AnimationAction;

  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });
    root.innerHTML = TEMPLATE;
    this.wrap = root.querySelector(".canvas-wrap") as HTMLDivElement;
    this.statusEl = root.querySelector(".status") as HTMLDivElement;

    const renderer = new WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = this.numberAttr("exposure", 1);
    this.renderer = renderer;
    this.wrap.appendChild(renderer.domElement);

    // Procedural studio lighting — no external HDRI fetch, works offline.
    const pmrem = new PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

    this.camera.position.set(0, 0.4, 4);

    const controls = new OrbitControls(this.camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.autoRotate = this.boolAttr("auto-rotate");
    controls.autoRotateSpeed = this.numberAttr("rotate-speed", 1);
    this.controls = controls;

    this.applyBackground();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this);
    this.resize();

    this.renderLoop();

    const src = this.getAttribute("src");
    if (src) this.load(src);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this.frame);
    this.resizeObserver?.disconnect();
    this.mixer?.stopAllAction();
    this.controls?.dispose();
    this.renderer?.dispose();
    this.renderer?.forceContextLoss?.();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null) {
    if (!this.renderer) return; // not connected yet
    switch (name) {
      case "src":
        if (value && value !== this.currentSrc) this.load(value);
        break;
      case "background":
        this.applyBackground();
        break;
      case "auto-rotate":
        if (this.controls) this.controls.autoRotate = value !== null && value !== "false";
        break;
      case "rotate-speed":
        if (this.controls) this.controls.autoRotateSpeed = this.numberAttr("rotate-speed", 1);
        break;
      case "exposure":
        this.renderer.toneMappingExposure = this.numberAttr("exposure", 1);
        break;
      case "animation":
        this.playClip(value);
        break;
    }
  }

  private boolAttr(name: string): boolean {
    const v = this.getAttribute(name);
    return v !== null && v !== "false";
  }

  private numberAttr(name: string, fallback: number): number {
    const v = parseFloat(this.getAttribute(name) ?? "");
    return Number.isFinite(v) ? v : fallback;
  }

  private applyBackground() {
    const bg = this.getAttribute("background");
    if (bg && bg !== "transparent") {
      this.scene.background = new Color(bg);
      this.renderer?.setClearAlpha(1);
    } else {
      this.scene.background = null;
      this.renderer?.setClearColor(0x000000, 0);
    }
  }

  private setStatus(text: string | null) {
    if (!this.statusEl) return;
    if (text === null) {
      this.statusEl.hidden = true;
    } else {
      this.statusEl.hidden = false;
      this.statusEl.textContent = text;
    }
  }

  private resize() {
    if (!this.renderer) return;
    const w = this.clientWidth || 1;
    const h = this.clientHeight || 1;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  private renderLoop = () => {
    this.frame = requestAnimationFrame(this.renderLoop);
    const dt = this.clock.getDelta();
    this.mixer?.update(dt);
    this.controls?.update();
    if (this.renderer) this.renderer.render(this.scene, this.camera);
  };

  /** Crossfade to a named clip (falls back to the first clip, or "idle"). */
  private playClip(name: string | null) {
    if (!this.mixer || !this.clips.length) return;
    const clip =
      this.clips.find((c) => c.name === name) ??
      this.clips.find((c) => c.name === "idle") ??
      this.clips[0];
    if (!clip) return;
    const next = this.mixer.clipAction(clip);
    if (next === this.currentAction) return;
    next.reset().setEffectiveWeight(1).play();
    if (this.currentAction) {
      this.currentAction.crossFadeTo(next, 0.3, false);
    }
    this.currentAction = next;
  }

  private load(src: string) {
    this.currentSrc = src;
    const token = ++this.loadToken;
    this.setStatus("loading…");

    const draco = new DRACOLoader().setDecoderPath(DRACO_DECODER_PATH);
    const loader = new GLTFLoader().setDRACOLoader(draco);

    loader.load(
      src,
      (gltf) => {
        if (token !== this.loadToken) return; // superseded by a newer load
        if (this.modelRoot) this.scene.remove(this.modelRoot);
        this.mixer?.stopAllAction();
        this.mixer = undefined;
        this.currentAction = undefined;
        this.modelRoot = gltf.scene;
        this.scene.add(gltf.scene);
        this.frameModel(gltf.scene);
        // wire up embedded animations, if any
        this.clips = gltf.animations ?? [];
        if (this.clips.length) {
          this.mixer = new AnimationMixer(gltf.scene);
          this.playClip(this.getAttribute("animation"));
        }
        this.setStatus(null);
        draco.dispose();
        this.dispatchEvent(new CustomEvent("load"));
      },
      undefined,
      (err) => {
        if (token !== this.loadToken) return;
        this.setStatus("failed to load model");
        draco.dispose();
        this.dispatchEvent(new CustomEvent("error", { detail: err }));
      },
    );
  }

  /** Center the model at the origin and frame the camera to fit it. */
  private frameModel(object: import("three").Object3D) {
    const box = new Box3().setFromObject(object);
    const sphere = box.getBoundingSphere(new Sphere());
    const center = sphere.center;

    object.position.sub(center); // recenter at origin

    const radius = sphere.radius || 1;
    const fov = (this.camera.fov * Math.PI) / 180;
    // Extra margin so the model has breathing room even in short/wide frames.
    const distance = (radius / Math.sin(fov / 2)) * 1.6;

    this.camera.position.set(0, radius * 0.12, distance);
    this.camera.near = distance / 100;
    this.camera.far = distance * 100;
    this.camera.updateProjectionMatrix();

    if (this.controls) {
      this.controls.target.set(0, 0, 0);
      this.controls.minDistance = distance * 0.4;
      this.controls.maxDistance = distance * 3;
      this.controls.update();
    }
  }
}

export function defineSkinMintModel(tag = "skinmint-model") {
  if (typeof customElements !== "undefined" && !customElements.get(tag)) {
    customElements.define(tag, SkinMintModel);
  }
}
