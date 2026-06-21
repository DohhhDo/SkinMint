# SkinMint skin model on Modal

Stable, scale-to-zero hosting for the fine-tuned Minecraft skin model
(`monadical-labs/minecraft-skin-generator-sdxl`). It does **text → skin** and
**image → skin (img2img)** — the latter is what makes uploaded 立绘 come out well.
You only pay while it's actually generating; it sleeps (free) the rest of the time.

> Why self-host instead of a hosted image API? General image models (Gemini,
> Qwen) make a character *picture*, not the 64×64 skin UV layout the model
> builder needs. Only this fine-tuned model produces a real skin. Self-hosting
> also means no per-call vendor cost and no data sent to a third party.

---

## 1. Prerequisites

A (free) Modal account — sign up at [modal.com](https://modal.com). The free tier
includes monthly credits that cover light use.

## 2. Deploy (one-time, ~2 min of typing)

```bash
pip install modal
modal token new                                    # opens a browser to auth

# pick a long random shared secret (used to lock down your endpoint):
modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=$(openssl rand -hex 24)
#   ^ copy the value it stores — you'll need it below.
#   Or set your own: modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=my-long-secret

modal deploy infra/modal/skin.py                   # prints your endpoint URL
```

`modal deploy` prints a URL like:

```
https://<your-workspace>--skinmint-mc-skin-skinmodel-generate.modal.run
```

## 3. Wire it into the app

Add both to `examples/next-demo/.env.local` (gitignored — never commit):

```bash
MODAL_SKIN_ENDPOINT=https://<your-workspace>--skinmint-mc-skin-skinmodel-generate.modal.run
MODAL_SKIN_TOKEN=<the SKINMINT_SKIN_TOKEN value from step 2>
```

Then restart the dev server (Next reads env at startup):

```bash
pnpm --filter next-demo dev
```

## 4. Test the endpoint directly (recommended before relying on it)

```bash
curl -X POST "$MODAL_SKIN_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"a knight in red armor","token":"<your token>"}' \
  --output test-skin.png
```

The **first** call after deploy (or after it's been asleep) downloads the model
and warms the GPU — expect **~1–3 min**. Subsequent calls take a few seconds.
Open `test-skin.png`: you should see a 64×64 Minecraft skin layout.

---

## How it plugs into uploads

The upload pipeline is two stages (`examples/next-demo/app/api/mc-upload`):

```
upload 立绘
  ① standardize   Gemini / Qwen-Image-Edit → clean front-facing character   (BYO-key)
  ② skinify       THIS Modal endpoint, img2img → real 64×64 skin            (best quality)
  → @skinmint/mcmodel → animated GLB
```

Once `MODAL_SKIN_ENDPOINT` is set, stage ② automatically uses Modal img2img
instead of the free `describe → text→skin` fallback.

## Under the hood

- `gpu="A10G"`, model loaded once per container (`@modal.enter`); text2img and
  img2img share the **same** weights via `AutoPipelineForImage2Image.from_pipe`.
- `scaledown_window=120` — stays warm 2 min after the last request, then scales to
  zero (no idle cost).
- Generates at 768×768 (required by this model), center-samples each 12px block
  down to a crisp 64×64 RGBA skin (with the overlay/transparency layer).
- Request body: `{ prompt, steps?, seed?, token?, image?, strength? }`. With
  `image` (base64) it runs img2img; otherwise text2img. Returns `image/png`.
- Consumed by `@skinmint/skin`'s `ModalSkinProvider`.

## Cost

A10G is ~$0.000306/s. A generation is a few GPU-seconds; the cost driver is the
occasional cold start. With scale-to-zero, a low-traffic demo is typically cents
to a couple dollars a month — and the free-tier credits often cover it.

## Troubleshooting

- **`modal deploy` errors on a decorator** — update Modal: `pip install -U modal`
  (this file targets Modal 1.0+: `@modal.fastapi_endpoint`, `scaledown_window`).
- **`401 unauthorized`** from the endpoint — the `token` in your request doesn't
  match `SKINMINT_SKIN_TOKEN`. Re-check `MODAL_SKIN_TOKEN` in `.env.local`.
- **Model download fails / gated** — if HF ever gates the model, add your HF token
  to the secret (`modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=... HF_TOKEN=hf_...`)
  and it'll be picked up at load.
- **Slow first request** — expected (cold start + model download). It's fast once warm.
