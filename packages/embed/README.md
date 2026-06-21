# @skinmint/embed

A zero-dependency `<skinmint-model>` web component — drop a GLB into **any** page or
app. Built on three.js, isolated in a Shadow DOM. No React, no build step
required on the consumer side.

## Use it (plain HTML)

```html
<script src="https://cdn.jsdelivr.net/npm/@skinmint/embed/dist/skinmint-embed.global.js"></script>
<skinmint-model
  src="https://your-host/model.glb"
  style="width:100%;height:480px"
></skinmint-model>
```

The `.global.js` build bundles three.js, so it's fully self-contained.

## Use it (bundler / framework)

```bash
npm i @skinmint/embed
```

```js
import "@skinmint/embed"; // registers <skinmint-model>
```

```html
<skinmint-model src="/model.glb"></skinmint-model>
```

The ESM build keeps `three` as an external import so your bundler dedupes it.

## Attributes

| Attribute      | Default       | Description                                          |
| -------------- | ------------- | ---------------------------------------------------- |
| `src`          | —             | GLB/glTF URL (Draco + WebP supported).               |
| `animation`    | `idle`        | Clip name to play, if the GLB has clips. Crossfades on change. |
| `background`   | `transparent` | CSS color, or omit for transparent.                  |
| `auto-rotate`  | off           | Presence (or `="true"`) spins the model.             |
| `rotate-speed` | `1`           | Auto-rotate speed.                                   |
| `exposure`     | `1`           | Tone-mapping exposure.                               |

**Drag to orbit**, lighting is procedural (no external HDRI fetch, works offline).

If the GLB has animation clips, they play automatically — set `animation` to
pick one, change it at runtime to crossfade. SkinMint's [`@skinmint/mcmodel`](../mcmodel)
models ship `idle` / `walk` / `run` / `wave`. A GLB with no clips just renders
static.

## Notes

- Draco decoder loads from the gstatic CDN on demand.
- Emits `load` and `error` events.
- Cross-origin models need CORS (`Access-Control-Allow-Origin`) on the GLB host —
  `@skinmint/server` sets this automatically; if you self-host the GLB next to your
  page it's same-origin and needs nothing.
