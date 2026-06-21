// The skin backend: the SkinMint Modal deployment of the monadical
// minecraft-skin SDXL model. Contract (infra/modal/skin.py):
//   POST { prompt, steps, seed, token, image?, strength? } → 64×64 PNG
//
// TWO MODES, and the difference matters a lot:
//
//   text2img (NO image)  — the model generates a real UV-atlas skin from the
//                          prompt. This is what the model was trained to do.
//                          ✅ produces a valid, in-game skin.
//
//   img2img (with image) — starts from your 立绘 as the canvas and denoises it.
//                          A 立绘's layout is "a standing character", not a UV
//                          atlas, so the output stays a stylized picture and the
//                          downsample just shrinks it. ❌ NOT a real skin.
//                          Kept only as an explicit, clearly-labeled experiment.
//
// Borrows MODAL_SKIN_ENDPOINT / MODAL_SKIN_TOKEN; no @skinmint import.

/**
 * @param {{
 *   endpoint: string, token?: string, prompt: string,
 *   seed?: number, steps?: number,
 *   initImage?: Uint8Array,   // ONLY pass for the experimental img2img mode
 *   strength?: number,
 * }} opts
 * @returns {Promise<Uint8Array>} 64×64 RGBA PNG bytes
 */
export async function generateSkin(opts) {
  const { endpoint, token, prompt } = opts;
  if (!endpoint) throw new Error("generateSkin requires a Modal endpoint");
  if (!prompt) throw new Error("generateSkin requires a prompt");

  const body = {
    prompt,
    steps: opts.steps ?? 25,
    seed: opts.seed ?? 0,
    token,
  };
  // Only include `image` when explicitly doing the experimental img2img pass.
  if (opts.initImage) {
    body.image = Buffer.from(opts.initImage).toString("base64");
    body.strength = opts.strength ?? 0.7;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal skin endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Clean anime matte via the isnet-anime segmentation endpoint
 * (lab/tachie2skin/modal/segment.py). Returns an RGBA PNG cutout with the
 * background made transparent — robust where local color flood-fill fails.
 *
 * @param {{ endpoint: string, token?: string, image: Uint8Array }} opts
 * @returns {Promise<Uint8Array>} RGBA PNG bytes
 */
export async function segmentImage(opts) {
  const { endpoint, token, image } = opts;
  if (!endpoint) throw new Error("Segmentation endpoint not configured (MODAL_SEG_ENDPOINT).");
  if (!image) throw new Error("segmentImage requires an image");
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image: Buffer.from(image).toString("base64"), token }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal segment endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Identity-preserving generation via the separate IP-Adapter endpoint
 * (lab/tachie2skin/modal/skin_ipa.py). The 立绘 is an IP-Adapter *reference*,
 * not an init canvas — the model still generates a real atlas from noise, biased
 * toward the character. This is the "立绘 → 像这个角色的皮肤" path.
 *
 * @param {{
 *   endpoint: string, token?: string, prompt: string,
 *   refImage: Uint8Array, ipScale?: number, seed?: number, steps?: number,
 * }} opts
 * @returns {Promise<Uint8Array>} 64×64 RGBA PNG bytes
 */
export async function generateSkinIPA(opts) {
  const { endpoint, token, prompt, refImage } = opts;
  if (!endpoint) {
    throw new Error(
      "IP-Adapter endpoint not configured. Deploy lab/tachie2skin/modal/skin_ipa.py " +
        "and set MODAL_SKIN_IPA_ENDPOINT.",
    );
  }
  if (!prompt) throw new Error("generateSkinIPA requires a prompt");
  if (!refImage) throw new Error("generateSkinIPA requires a reference 立绘");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      image: Buffer.from(refImage).toString("base64"),
      ip_scale: opts.ipScale ?? 0.6,
      seed: opts.seed ?? 0,
      steps: opts.steps ?? 30,
      token,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Modal IP-Adapter endpoint ${res.status}: ${text.slice(0, 200)}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}
