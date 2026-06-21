"""
IP-Adapter identity-preserving Minecraft skin model — standalone Modal deployment
for the lab/tachie2skin tool. Does NOT touch the main SkinMint skin endpoint
(infra/modal/skin.py); it is a separate Modal app with its own endpoint.

What it does differently from the main endpoint:
  - The 立绘 is fed to the model as an IP-Adapter *image reference* (a semantic
    conditioning signal), NOT as an img2img init canvas. So the model still
    generates a real UV-atlas skin FROM NOISE (text2img), but biased toward the
    character's identity — hair, palette, outfit carry over while the output
    stays a valid 64x64 skin atlas.

Deploy:
    pip install modal
    modal token new                       # if this machine isn't authed yet
    # reuses the existing 'skinmint-skin' secret (SKINMINT_SKIN_TOKEN). If you don't have it:
    #   modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=<a-long-random-string>
    modal deploy lab/tachie2skin/modal/skin_ipa.py     # prints the web endpoint URL

Then add to lab/tachie2skin/.env (or examples/next-demo/.env.local):
    MODAL_SKIN_IPA_ENDPOINT=<the printed url>
    # the bearer token reuses MODAL_SKIN_TOKEN (same 'skinmint-skin' secret)
"""

import io
import os

import modal

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "torch",
        "diffusers>=0.27",
        "transformers",
        "accelerate",
        "safetensors",
        "pillow",
        "numpy",
        "fastapi[standard]",
    )
)

app = modal.App("skinmint-lab-mc-skin-ipa")

MODEL = "monadical-labs/minecraft-skin-generator-sdxl"
# IP-Adapter for SDXL. ip-adapter_sdxl.bin pairs with the ViT-bigG image encoder
# that lives in the repo's sdxl_models/image_encoder subfolder.
IP_REPO = "h94/IP-Adapter"
IP_SUBFOLDER = "sdxl_models"
IP_WEIGHT = "ip-adapter_sdxl.bin"
IP_IMAGE_ENCODER = "sdxl_models/image_encoder"


@app.cls(
    gpu="A10G",
    image=image,
    secrets=[modal.Secret.from_name("skinmint-skin")],
    scaledown_window=120,  # stay warm 2 min after the last request, then scale to zero
    timeout=600,
)
class SkinIPAModel:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import DiffusionPipeline
        from transformers import CLIPVisionModelWithProjection

        # Load the bigG image encoder explicitly so it matches ip-adapter_sdxl.bin.
        image_encoder = CLIPVisionModelWithProjection.from_pretrained(
            IP_REPO, subfolder=IP_IMAGE_ENCODER, torch_dtype=torch.float16
        )
        self.pipe = DiffusionPipeline.from_pretrained(
            MODEL, image_encoder=image_encoder, torch_dtype=torch.float16
        ).to("cuda")
        self.pipe.load_ip_adapter(IP_REPO, subfolder=IP_SUBFOLDER, weight_name=IP_WEIGHT)

    @modal.fastapi_endpoint(method="POST")
    def generate(self, data: dict):
        import base64

        import numpy as np
        import torch
        from fastapi import HTTPException, Response
        from PIL import Image

        token = os.environ.get("SKINMINT_SKIN_TOKEN")
        if token and data.get("token") != token:
            raise HTTPException(status_code=401, detail="unauthorized")

        prompt = (data.get("prompt") or "").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")
        ref_b64 = data.get("image")
        if not ref_b64:
            raise HTTPException(status_code=400, detail="image (reference 立绘) is required")

        steps = int(data.get("steps", 30))
        seed = int(data.get("seed", 0))
        # IP-Adapter strength: how strongly the 立绘 identity is imposed. 0.4–0.8 typical.
        ip_scale = float(data.get("ip_scale", 0.6))
        generator = torch.Generator("cuda").manual_seed(seed) if seed else None

        ref = Image.open(io.BytesIO(base64.b64decode(ref_b64))).convert("RGB")
        self.pipe.set_ip_adapter_scale(ip_scale)
        big = (
            self.pipe(
                prompt=prompt,
                ip_adapter_image=ref,
                num_inference_steps=steps,
                guidance_scale=7.5,
                height=768,
                width=768,
                generator=generator,
            )
            .images[0]
            .convert("RGBA")
        )

        # Same atlas extraction as the main endpoint: the 768 image is the 64x64
        # skin at 12x — center-sample each 12px block.
        arr = np.array(big)
        small = arr[6::12, 6::12][:64, :64]
        out = io.BytesIO()
        Image.fromarray(small, "RGBA").save(out, format="PNG")
        return Response(content=out.getvalue(), media_type="image/png")
