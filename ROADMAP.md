# Roadmap

Where SkinMint is and where it's going. This is a living document for an
in-development project — expect it to drift as we learn what's worth building.

Status key: ✅ done · 🚧 in progress · 🔜 planned · 💭 idea / unsure

## Done

- ✅ **Monorepo** — pnpm + Turborepo, 9 packages building to ESM/CJS/types
- ✅ **`@skinmint/mcmodel`** — 64×64 skin → blocky GLB, box rig, `KHR_materials_unlit` + nearest filter
- ✅ **Animation** — limbs as rig nodes; baked `idle / walk / run / wave` clips
- ✅ **`<skinmint-model>` plays clips** — `AnimationMixer`, crossfade on `animation` change
- ✅ **Curated path** — 25 Genshin characters → instant animated models from hand-made skins
- ✅ **Upload 立绘** — img2img (Modal) **and** a no-GPU caption→skin fallback (HF vision model)
- ✅ **The Studio** — guided creator (角色 → 造型 → 动作 → 生成 → result), redesigned to the "Warm Craft Studio" look
- ✅ **Export** — web-component snippet / npm / optimized `.glb`
- ✅ **Legacy text→mesh track** — Meshy provider, `optimizeGlb()`, BYO-key server, viewer (verified end-to-end)

## In progress

- 🚧 **AI skin quality** — usable but inconsistent; better prompts, seeds, and post-processing
- 🚧 **Docs** — this set is the first real pass
- 🚧 **Pedestal / framing polish** — the collectible presentation could be tighter

## Planned

- 🔜 **More curated IPs** — 绝区零 / 星穹铁道 are stubbed; needs skin + icon collection
- 🔜 **Outfit / variant skins** — "造型" currently means proportions + base, not real wardrobe swaps
- 🔜 **More actions** — sit, attack, idle variants; per-character action tuning
- 🔜 **Publish to npm** — nothing is published yet; needs versioning + a release flow
- 🔜 **Modal img2img deploy guide** — `infra/modal/skin.py` is ready; document the one-time setup
- 🔜 **A second text→mesh provider** — the `Provider` interface keeps Tripo a drop-in

## Ideas (unfunded)

- 💭 Custom skin editor (paint the 64×64 directly in-app)
- 💭 Pose/animation editor beyond the preset clips
- 💭 Batch generation + a shareable gallery
- 💭 A hosted demo so people can try it without cloning

## Known limitations

- AI skins look like AI skins — fine for fun, not production character art.
- The free public HF Space hits ZeroGPU quota and fails intermittently; an
  `HF_TOKEN` helps, a Modal deploy is the stable path.
- `api-inference.huggingface.co` is retired; captioning uses the HF router and
  depends on which providers your token has enabled.
- Only Genshin characters are curated; everything else needs the AI path.
