import { Document, NodeIO, TextureInfo, type Accessor } from "@gltf-transform/core";
import { KHRMaterialsUnlit } from "@gltf-transform/extensions";
import { BoxGeometry } from "three";

/** Animation clips embedded in every model. The viewer picks one to play. */
export const CLIPS = ["idle", "walk", "run", "wave"] as const;
export type Clip = (typeof CLIPS)[number];
export type Pose = "stand" | "tpose" | "wave" | "run" | "battle";

export interface BuildOptions {
  /** Build the second (overlay) layer. Default: true. */
  overlay?: boolean;
  /** Chibi proportions — an oversized head. Default: false. */
  chibi?: boolean;
  /** Display base block under the feet. Default: false. */
  base?: boolean;
  /** Embed walk/run/wave/idle animation clips. Default: true. */
  animated?: boolean;
}

type Face = "px" | "nx" | "py" | "ny" | "pz" | "nz";
type Rect = [number, number, number, number];
type Axis = "x" | "y" | "z";

const S = 1 / 16;
const E = 0.5; // overlay expand px
const D = (deg: number) => (deg * Math.PI) / 180;
const TAU = Math.PI * 2;

const TORSO = { off: [16, 16], ov: [16, 32], size: [8, 12, 4], center: [0, 18, 0] };
const LIMBS = [
  { key: "rightArm", off: [40, 16], ov: [40, 32], size: [4, 12, 4], joint: [-6, 24, 0] },
  { key: "leftArm", off: [32, 48], ov: [48, 48], size: [4, 12, 4], joint: [6, 24, 0] },
  { key: "rightLeg", off: [0, 16], ov: [0, 32], size: [4, 12, 4], joint: [-2, 12, 0] },
  { key: "leftLeg", off: [16, 48], ov: [0, 48], size: [4, 12, 4], joint: [2, 12, 0] },
] as const;
type LimbKey = (typeof LIMBS)[number]["key"];

function faceRects(ox: number, oy: number, w: number, h: number, d: number): Record<Face, Rect> {
  return {
    py: [ox + d, oy, w, d],
    ny: [ox + d + w, oy, w, d],
    nx: [ox, oy + d, d, h],
    pz: [ox + d, oy + d, w, h],
    px: [ox + d + w, oy + d, d, h],
    nz: [ox + d + w + d, oy + d, w, h],
  };
}

interface Geo {
  position: number[];
  uv: number[];
  index: number[];
}
const FACE_ORDER: Face[] = ["px", "nx", "py", "ny", "pz", "nz"];

/** Box centered at origin with per-face skin UVs (glTF top-left UVs — no V flip). */
function boxUV(size: number[], faces: Record<Face, Rect>): BoxGeometry {
  const g = new BoxGeometry(size[0]! * S, size[1]! * S, size[2]! * S);
  const uv = g.attributes.uv!;
  FACE_ORDER.forEach((f, fi) => {
    const [x, y, w, h] = faces[f];
    const u0 = x / 64, v0 = y / 64, u1 = (x + w) / 64, v1 = (y + h) / 64;
    const i = fi * 4;
    uv.setXY(i + 0, u0, v0);
    uv.setXY(i + 1, u1, v0);
    uv.setXY(i + 2, u0, v1);
    uv.setXY(i + 3, u1, v1);
  });
  return g;
}

function emptyGeo(): Geo {
  return { position: [], uv: [], index: [] };
}
function mergeInto(geo: Geo, g: BoxGeometry) {
  const base = geo.position.length / 3;
  const pos = g.attributes.position!.array;
  const uv = g.attributes.uv!.array;
  const idx = g.index!.array;
  for (let i = 0; i < pos.length; i++) geo.position.push(pos[i]!);
  for (let i = 0; i < uv.length; i++) geo.uv.push(uv[i]!);
  for (let i = 0; i < idx.length; i++) geo.index.push(base + idx[i]!);
}
/** A box translated to a world-space center (px). */
function atCenter(center: number[], size: number[], faces: Record<Face, Rect>): BoxGeometry {
  const g = boxUV(size, faces);
  g.translate(center[0]! * S, center[1]! * S, center[2]! * S);
  return g;
}
/** A limb box whose joint (top) sits at the LOCAL origin, so a node can rotate it about the joint. */
function atJoint(size: number[], faces: Record<Face, Rect>): BoxGeometry {
  const g = boxUV(size, faces);
  g.translate(0, -(size[1]! * S) / 2, 0);
  return g;
}

function quat(axis: Axis, deg: number): [number, number, number, number] {
  const a = D(deg) / 2, s = Math.sin(a), c = Math.cos(a);
  return axis === "x" ? [s, 0, 0, c] : axis === "y" ? [0, s, 0, c] : [0, 0, s, c];
}

export async function buildMinecraftGLB(skinPng: Uint8Array, options: BuildOptions = {}): Promise<Uint8Array> {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const unlit = doc.createExtension(KHRMaterialsUnlit);
  const tex = doc.createTexture("skin").setImage(skinPng).setMimeType("image/png");
  const withOverlay = options.overlay !== false;
  const animated = options.animated !== false;

  const skinMaterial = (name: string, mask: boolean) => {
    const m = doc
      .createMaterial(name)
      .setBaseColorFactor([1, 1, 1, 1])
      .setBaseColorTexture(tex)
      .setRoughnessFactor(1)
      .setMetallicFactor(0)
      .setDoubleSided(true);
    if (mask) m.setAlphaMode("MASK").setAlphaCutoff(0.5);
    m.setExtension("KHR_materials_unlit", unlit.createUnlit());
    m.getBaseColorTextureInfo()!.setMagFilter(TextureInfo.MagFilter.NEAREST!).setMinFilter(TextureInfo.MinFilter.NEAREST!);
    return m;
  };
  const baseMat = skinMaterial("base", false);
  const ovMat = withOverlay ? skinMaterial("overlay", true) : null;

  const prim = (geo: Geo, mat: ReturnType<typeof skinMaterial>) => {
    const pos = doc.createAccessor().setType("VEC3").setArray(new Float32Array(geo.position)).setBuffer(buffer);
    const uv = doc.createAccessor().setType("VEC2").setArray(new Float32Array(geo.uv)).setBuffer(buffer);
    const idx = doc.createAccessor().setType("SCALAR").setArray(new Uint16Array(geo.index)).setBuffer(buffer);
    return doc.createPrimitive().setAttribute("POSITION", pos).setAttribute("TEXCOORD_0", uv).setIndices(idx).setMaterial(mat);
  };

  const headSize = 8 * (options.chibi ? 1.7 : 1);
  const headCY = 24 + headSize / 2;

  const root = doc.createNode("character");
  doc.createScene().addChild(root);

  // ---- static node: head + body (+ overlay, + base block) ----
  const staticMesh = doc.createMesh("static");
  const sBase = emptyGeo();
  mergeInto(sBase, atCenter([0, headCY, 0], [headSize, headSize, headSize], faceRects(0, 0, 8, 8, 8)));
  mergeInto(sBase, atCenter(TORSO.center, TORSO.size, faceRects(TORSO.off[0]!, TORSO.off[1]!, 8, 12, 4)));
  staticMesh.addPrimitive(prim(sBase, baseMat));
  if (ovMat) {
    const sOv = emptyGeo();
    mergeInto(sOv, atCenter([0, headCY, 0], [headSize + 2 * E, headSize + 2 * E, headSize + 2 * E], faceRects(32, 0, 8, 8, 8)));
    mergeInto(sOv, atCenter(TORSO.center, [TORSO.size[0]! + 2 * E, TORSO.size[1]! + 2 * E, TORSO.size[2]! + 2 * E], faceRects(TORSO.ov[0]!, TORSO.ov[1]!, 8, 12, 4)));
    staticMesh.addPrimitive(prim(sOv, ovMat));
  }
  if (options.base) {
    const blockMat = doc.createMaterial("base-block").setBaseColorFactor([0.16, 0.16, 0.19, 1]).setRoughnessFactor(1).setMetallicFactor(0).setDoubleSided(true);
    blockMat.setExtension("KHR_materials_unlit", unlit.createUnlit());
    const block = emptyGeo();
    mergeInto(block, atCenter([0, -0.5, 0], [14, 1, 14], faceRects(0, 0, 8, 8, 8)));
    staticMesh.addPrimitive(prim(block, blockMat as ReturnType<typeof skinMaterial>));
  }
  root.addChild(doc.createNode("body").setMesh(staticMesh));

  // ---- limb nodes (rotatable about their joint) ----
  const limbNode: Record<string, ReturnType<typeof doc.createNode>> = {};
  for (const l of LIMBS) {
    const [w, h, d] = l.size;
    const mesh = doc.createMesh(l.key);
    const gb = emptyGeo();
    mergeInto(gb, atJoint([w!, h!, d!], faceRects(l.off[0]!, l.off[1]!, w!, h!, d!)));
    mesh.addPrimitive(prim(gb, baseMat));
    if (ovMat) {
      const go = emptyGeo();
      mergeInto(go, atJoint([w! + 2 * E, h! + 2 * E, d! + 2 * E], faceRects(l.ov[0]!, l.ov[1]!, w!, h!, d!)));
      mesh.addPrimitive(prim(go, ovMat));
    }
    const node = doc.createNode(l.key).setMesh(mesh).setTranslation([l.joint[0]! * S, l.joint[1]! * S, l.joint[2]! * S]);
    limbNode[l.key] = node;
    root.addChild(node);
  }

  // ---- animation clips ----
  if (animated) {
    const N = 8; // keyframes per loop
    type Track = { limb: LimbKey; axis: Axis; angle: (p: number) => number };
    const swing = (A: number, phase: number) => (p: number) => A * Math.sin(TAU * p + phase);

    const addClip = (name: string, period: number, tracks: Track[]) => {
      const anim = doc.createAnimation(name);
      const times: number[] = [];
      for (let k = 0; k <= N; k++) times.push(+((period * k) / N).toFixed(4));
      const tIn: Accessor = doc.createAccessor().setType("SCALAR").setArray(new Float32Array(times)).setBuffer(buffer);
      for (const tr of tracks) {
        const out: number[] = [];
        for (let k = 0; k <= N; k++) out.push(...quat(tr.axis, tr.angle(k / N)));
        const oAcc = doc.createAccessor().setType("VEC4").setArray(new Float32Array(out)).setBuffer(buffer);
        const sampler = doc.createAnimationSampler().setInput(tIn).setOutput(oAcc).setInterpolation("LINEAR");
        const channel = doc.createAnimationChannel().setTargetNode(limbNode[tr.limb]!).setTargetPath("rotation").setSampler(sampler);
        anim.addSampler(sampler).addChannel(channel);
      }
    };

    addClip("walk", 1.0, [
      { limb: "rightLeg", axis: "x", angle: swing(30, 0) },
      { limb: "leftLeg", axis: "x", angle: swing(30, Math.PI) },
      { limb: "rightArm", axis: "x", angle: swing(22, Math.PI) },
      { limb: "leftArm", axis: "x", angle: swing(22, 0) },
    ]);
    addClip("run", 0.62, [
      { limb: "rightLeg", axis: "x", angle: swing(48, 0) },
      { limb: "leftLeg", axis: "x", angle: swing(48, Math.PI) },
      { limb: "rightArm", axis: "x", angle: swing(42, Math.PI) },
      { limb: "leftArm", axis: "x", angle: swing(42, 0) },
    ]);
    addClip("wave", 0.8, [
      { limb: "rightArm", axis: "z", angle: (p) => 150 + 16 * Math.sin(TAU * p) },
      { limb: "leftArm", axis: "x", angle: swing(6, 0) },
    ]);
    addClip("idle", 2.6, [
      { limb: "rightArm", axis: "x", angle: swing(5, 0) },
      { limb: "leftArm", axis: "x", angle: swing(5, Math.PI) },
    ]);
  }

  return new NodeIO().registerExtensions([KHRMaterialsUnlit]).writeBinary(doc);
}
