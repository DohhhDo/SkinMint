# The Minecraft pipeline

How a flat 64×64 image becomes a rigged GLB that walks. Two packages do the
work: [`@skinmint/skin`](../packages/skin) makes the skin, and
[`@skinmint/mcmodel`](../packages/mcmodel) builds the model.

## The core idea

A Minecraft character is a **fixed box rig** wearing a **64×64 skin**. The rig
never changes — head, torso, two arms, two legs, plus a slightly inflated
"overlay" layer (hair, jacket, hat). So generating a *character* is really just
generating a *skin*, and the 3D part is deterministic.

That's the whole trick: hard problem (3D character) → easy problem (2D texture).

## Step 1 — get a 64×64 skin

Three ways, all producing the same `Uint8Array` PNG:

- **Curated** — a hand-made skin shipped under `public/skinmint/skins/<id>.png`.
  Best quality, instant, no AI.
- **AI from text** — a `SkinProvider` runs SDXL `minecraft-skin-generator` and
  returns a 64×64 PNG.
- **AI from an uploaded 立绘** — image-to-image, or (no GPU) a vision model
  describes the art and that text feeds the text→skin model.

The provider details — Modal, HF Space, the caption fallback, env vars — live in
[skin providers](skin-providers.md).

## Step 2 — build the model

```ts
import { buildMinecraftGLB } from "@skinmint/mcmodel";

const glb = await buildMinecraftGLB(skinPng, {
  overlay: true,    // build the hair/jacket overlay layer (default true)
  chibi: false,     // oversized head (Q版) (default false)
  base: false,      // add a display block under the feet (default false)
  animated: true,   // bake walk/run/wave/idle clips (default true)
});
// → Uint8Array (GLB bytes)
```

What `buildMinecraftGLB` does:

- Builds each body part as a `three.js` `BoxGeometry`, with per-face UVs mapped
  to the right rectangle of the 64×64 skin.
- Splits the rig into a **static node** (head + torso) and **four limb nodes**
  (arms, legs), each positioned at its joint so it can rotate in place.
- Uses `KHR_materials_unlit` + `NEAREST` texture filtering → crisp, flat pixels.
- Bakes animation clips as node-rotation tracks (see below).
- Serializes with [glTF Transform](https://gltf-transform.dev/).

### The UV gotcha

glTF UV origin is top-left and `GLTFLoader` sets `flipY=false`, so a skin pixel
at `(x, y)` maps to `(x/64, y/64)` — **no V flip**. Flipping V (the instinct
from raw three.js, where textures default to `flipY=true`) sends every face to
an empty region of the skin and you get an all-black model. Since UVs are
normalized by 64, a 128×128 HD skin renders correctly with no code changes.

## Step 3 — animation

Every model (unless `animated: false`) ships with four looping clips:

| Clip | Motion |
| --- | --- |
| `idle` | subtle arm sway |
| `walk` | legs + arms swing, opposite phase |
| `run` | bigger, faster swing |
| `wave` | right arm raised, oscillating; others idle |

Each clip is a set of node-rotation tracks — keyframed quaternions on the limb
nodes, sampled from sine curves so the loops are seamless. Because the limbs
pivot at their joints, the swing looks like real articulation, not a sliding box.

The viewer ([`@skinmint/embed`](../packages/embed)) reads `gltf.animations`, spins up
an `AnimationMixer`, and plays the clip named by the `animation` attribute —
crossfading when it changes. Switching action is **instant and client-side**;
you don't rebuild the GLB. That's why the Studio bakes all four clips once and
lets you flip between them live.

## Curated vs AI — when to use which

| | Curated | AI |
| --- | --- | --- |
| Quality | high (hand-made) | "fine, not great" |
| Speed | instant | seconds, sometimes flaky |
| Cost | free | GPU or HF quota |
| Coverage | only what's shipped | anything you can describe / upload |

The Studio defaults to curated for known characters and falls back to AI for
uploads and prompts. The model builder is identical either way — it only ever
sees a 64×64 PNG.

## Verifying changes

Geometry/animation bugs are visual, so we check them by rendering. The
`scripts/` folder has Playwright harnesses that load a built GLB, play a clip,
and screenshot it (using swiftshader so it runs headless). If you touch
`@skinmint/mcmodel`, render a few characters and poses before trusting it — a green
type-check won't catch a flipped UV.
