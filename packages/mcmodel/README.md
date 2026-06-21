# @skinmint/mcmodel

Turn a **64×64 Minecraft skin** into a **rigged, animated GLB**. Pure compute —
bytes in, bytes out. No network, no keys.

```ts
import { buildMinecraftGLB } from "@skinmint/mcmodel";

const glb = await buildMinecraftGLB(skinPng /* Uint8Array */, {
  overlay: true,   // hair/jacket/hat overlay layer            (default true)
  chibi: false,    // oversized head — Q版                      (default false)
  base: false,     // display block under the feet              (default false)
  animated: true,  // bake idle/walk/run/wave clips             (default true)
});
// → Uint8Array (a .glb you can save, serve, or hand to <skinmint-model>)
```

## What you get

A standard glTF binary with:

- The classic box rig — head, torso, two arms, two legs, plus an inflated
  overlay layer — built from `three.js` `BoxGeometry`.
- Each limb as its own **node**, pivoted at its joint, so animation rotates it
  in place.
- `KHR_materials_unlit` + `NEAREST` filtering → crisp flat pixels, no lighting
  smear, looks right on any background.
- Four looping animation clips (unless `animated: false`):

  ```ts
  import { CLIPS } from "@skinmint/mcmodel"; // ["idle", "walk", "run", "wave"]
  ```

Play them with [`@skinmint/embed`](../embed)'s `animation` attribute, or any
`three.js` `AnimationMixer`.

## Skins in, anything out

- Resolution-independent: UVs are normalized by 64, so 128×128 HD skins work
  unchanged.
- Supports the second (overlay) skin layer for hair, jackets, hats.
- The skin can come from anywhere — a curated PNG, [`@skinmint/skin`](../skin), or
  your own painter.

## One thing to know

glTF UVs are **not** V-flipped here (origin is top-left, `flipY=false`). A skin
pixel at `(x, y)` maps to `(x/64, y/64)`. Flipping V — the reflex from raw
three.js — maps faces onto empty skin regions and renders an all-black model.
More in [docs/minecraft-pipeline](../../docs/minecraft-pipeline.md).

## Build & test

```bash
pnpm --filter @skinmint/mcmodel build
pnpm --filter @skinmint/mcmodel test
```

Tests assert the rig structure and that clips drive the limb nodes; visual
correctness is checked by rendering (see `scripts/`), because a flipped UV
type-checks fine but renders black.
