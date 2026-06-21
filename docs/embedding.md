# Embedding `<skinmint-model>`

`<skinmint-model>` is a self-contained custom element — three.js in a Shadow DOM,
no React, no build step on your side. Point it at a GLB and it renders, lets you
drag to orbit, and plays whatever animation clips are baked in.

## Plain HTML

```html
<script src="https://your-host/skinmint-embed.global.js"></script>

<skinmint-model
  src="https://your-host/model.glb"
  animation="walk"
  style="width:100%;height:480px"
></skinmint-model>
```

The `.global.js` build bundles three.js, so it's fully self-contained — paste it
into any page you control.

## With a bundler

```bash
npm i @skinmint/embed     # (not published yet — see the roadmap)
```

```js
import "@skinmint/embed"; // registers <skinmint-model>
```

```html
<skinmint-model src="/model.glb" animation="run"></skinmint-model>
```

The ESM build keeps `three` external so your bundler dedupes it.

## Attributes

| Attribute | Default | Description |
| --- | --- | --- |
| `src` | — | GLB / glTF URL (Draco + WebP supported) |
| `animation` | `idle` | clip name to play — SkinMint models ship `idle` / `walk` / `run` / `wave` |
| `background` | `transparent` | CSS color, or omit / `"transparent"` to show the page through |
| `auto-rotate` | off | presence (or `="true"`) slowly spins the model |
| `rotate-speed` | `1` | auto-rotate speed |
| `exposure` | `1` | tone-mapping exposure |

Change `animation` at runtime and the viewer crossfades to the new clip — no
reload, no refetch. The model is drag-to-orbit; lighting is procedural (no
external HDRI), so it works offline. It emits `load` and `error` events.

## Animation, the short version

Clips are baked into the GLB by [`@skinmint/mcmodel`](../packages/mcmodel), so the
viewer doesn't need a list — it reads `gltf.animations` and plays the one named
by `animation`. To make a model loop a walk, you set one attribute. To let users
switch poses, you swap that attribute (that's exactly what the Studio's result
screen does).

## Serving the GLB

- **Same-origin** (the GLB sits next to your page): nothing to configure.
- **Cross-origin:** the GLB host must send `Access-Control-Allow-Origin`.
  `@skinmint/server` (and the Studio's `/api/generate`) set this for you; raw
  provider CDNs (e.g. Meshy) often don't, which is why SkinMint proxies them.

## React / Next.js

It's a custom element, so register it once (e.g. a dynamic import in a client
component) and use it like any tag. You'll want a one-line JSX typing so TS
accepts the element and its attributes — see
[`examples/next-demo/app/skinmint-model.d.ts`](../examples/next-demo/app/skinmint-model.d.ts).
