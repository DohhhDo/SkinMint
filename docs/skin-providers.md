# Skin providers

Everything that turns an idea into a 64×64 skin implements one interface:

```ts
interface SkinProvider {
  readonly name: string;
  generateSkin(prompt: string, options?: SkinOptions): Promise<SkinResult>; // → { png, width, height }
}
```

The rest of SkinMint only depends on that, so backends are swappable. Here's what
ships and when to use each.

## The providers

| Provider | Input | Needs | Notes |
| --- | --- | --- | --- |
| `MockSkinProvider` | text | nothing | deterministic palette from the prompt hash; for tests/offline |
| `HFSpaceSkinProvider` | text | `HF_TOKEN` (recommended) | free public HF Space; flaky under load (ZeroGPU quota) |
| `ModalSkinProvider` | text **or** image | your Modal deploy | stable, scale-to-zero; supports img2img |
| `HFCaptionProvider` | image → text | `HF_TOKEN` | not a skin provider — captions an image so a text provider can run |

## The three real paths

**Text → skin.** `ModalSkinProvider` if you've deployed Modal, else
`HFSpaceSkinProvider`. Both run the SDXL `minecraft-skin-generator` model.

**Upload 立绘 → skin, best quality.** `ModalSkinProvider` in image-to-image mode
— the upload conditions the generation directly. Needs the GPU deploy.

**Upload 立绘 → skin, no GPU.** When there's no Modal endpoint, the Studio's
`/api/mc-upload` falls back to: `HFCaptionProvider` describes the art with a
vision model → that description becomes a prompt → `HFSpaceSkinProvider` makes
the skin. Lower fidelity, but it works with just a free `HF_TOKEN`.

```
upload → [Modal img2img]            → skin     (if MODAL_SKIN_ENDPOINT)
upload → caption (HF) → text→skin   → skin     (else, needs HF_TOKEN)
```

## Environment variables

Set these in `examples/next-demo/.env.local` (gitignored — never commit keys):

```bash
HF_TOKEN=hf_xxx                 # free from huggingface.co; enables AI skins + caption fallback
MODAL_SKIN_ENDPOINT=https://... # optional; your deployed Modal endpoint (best path)
MODAL_SKIN_TOKEN=...            # the bearer token you set when deploying
MESHY_API_KEY=msy_xxx           # unrelated — only the legacy text→mesh track
```

With **no** keys, only curated characters work (which is plenty to try the app).

## Deploying Modal (the stable path)

The free HF Space is fine for poking around but unreliable for anything real.
For stability, deploy the model yourself — it scales to zero, so you only pay
while it's generating. The deployment lives in
[`infra/modal/skin.py`](../infra/modal/skin.py); a short walkthrough is in
[`infra/modal/README.md`](../infra/modal/README.md). In brief:

```bash
pip install modal
modal token new
modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=<a-long-random-string>
modal deploy infra/modal/skin.py     # prints your endpoint URL
```

Then put the URL and token into `.env.local`. The endpoint handles both
text→skin and (when you pass an init image) img2img.

## A note on HF inference

Hugging Face retired `api-inference.huggingface.co`. Serverless inference now
goes through `router.huggingface.co` (OpenAI-compatible). `HFCaptionProvider`
posts to its chat-completions endpoint with a vision model (default
`Qwen/Qwen3-VL-8B-Instruct`); which models you can reach depends on the
providers enabled for your token. If captioning returns "model not supported,"
check your token's enabled providers or pass a different `model`.

## Honest expectations

AI skins look like AI skins. The fine-tuned model is good *for what it is*, but
it won't match hand-made character art — expect "recognizable and fun," not
"production-ready." Curated skins exist precisely because they're so much better;
the AI paths are for coverage (uploads, arbitrary prompts), not for replacing
good artists.
