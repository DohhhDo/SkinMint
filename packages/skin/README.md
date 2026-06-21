# @skinmint/skin

Make a **64×64 Minecraft skin** — from a text prompt, or an uploaded image.
Everything implements one swappable interface; the rest of SkinMint only depends on
that.

```ts
interface SkinProvider {
  readonly name: string;
  generateSkin(prompt: string, options?: SkinOptions): Promise<SkinResult>; // → { png, width, height }
}
```

## Providers

```ts
import {
  MockSkinProvider,      // deterministic, offline — for tests
  HFSpaceSkinProvider,   // free public HF Space (text → skin); flaky under load
  ModalSkinProvider,     // your Modal deploy (text → skin, and img2img)
  HFCaptionProvider,     // image → text, so a text provider can run on an upload
  captionToSkinPrompt,   // tidy a caption into a skin prompt
} from "@skinmint/skin";
```

```ts
const skin = new HFSpaceSkinProvider({ model: "xl", steps: 22, hfToken: process.env.HF_TOKEN });
const { png } = await skin.generateSkin("a knight in red armor");
```

### Image-to-image (uploads)

`ModalSkinProvider` accepts an init image, conditioning generation on an
uploaded 立绘:

```ts
const { png } = await modal.generateSkin(prompt, { image: uploadBytes, strength: 0.6 });
```

### No-GPU upload fallback

No Modal endpoint? Caption the image first, then run a text provider:

```ts
const caption = await new HFCaptionProvider({ hfToken }).caption(imageBytes);
const { png } = await hfSpace.generateSkin(captionToSkinPrompt(caption));
```

`HFCaptionProvider` posts to the HF router's chat-completions endpoint with a
vision model (default `Qwen/Qwen3-VL-8B-Instruct`).

## Also included

- `SkinCanvas` + `encodePNG` — a tiny pixel canvas and PNG encoder for building
  skins by hand (no native deps).
- `faceRects` — the UV rectangle layout for a standard skin, shared with the
  model builder.

## Where the skin goes

Feed the `png` straight into [`@skinmint/mcmodel`](../mcmodel) to get a model. Env
vars, the Modal deploy, and trade-offs are in
[docs/skin-providers](../../docs/skin-providers.md).

## Build & test

```bash
pnpm --filter @skinmint/skin build
pnpm --filter @skinmint/skin test   # network is stubbed — no real API calls
```
