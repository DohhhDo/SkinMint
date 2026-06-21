"""
SkinMint Minecraft skin model — Modal deployment.

Hosts monadical-labs/minecraft-skin-generator-sdxl behind a stable HTTP endpoint
that returns a 64x64 Minecraft skin PNG. Scale-to-zero (you only pay while it's
actually generating), warm model load, optional bearer-token auth.

Deploy:
    pip install modal
    modal token new
    modal secret create skinmint-skin SKINMINT_SKIN_TOKEN=<a-long-random-string>
    modal deploy infra/modal/skin.py        # prints the web endpoint URL

Then in examples/next-demo/.env.local:
    MODAL_SKIN_ENDPOINT=<the printed url>
    MODAL_SKIN_TOKEN=<same random string>
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

app = modal.App("skinmint-mc-skin")

MODEL = "monadical-labs/minecraft-skin-generator-sdxl"


@app.cls(
    gpu="A10G",
    image=image,
    secrets=[modal.Secret.from_name("skinmint-skin")],
    scaledown_window=120,  # stay warm 2 min after the last request, then scale to zero
)
class SkinModel:
    @modal.enter()
    def load(self):
        import torch
        from diffusers import AutoPipelineForImage2Image, DiffusionPipeline

        self.pipe = DiffusionPipeline.from_pretrained(MODEL, torch_dtype=torch.float16).to("cuda")
        # img2img reuses the SAME loaded weights (no extra VRAM, no re-download) —
        # lets us condition on a standardized character image.
        self.img2img = AutoPipelineForImage2Image.from_pipe(self.pipe)

    @modal.fastapi_endpoint(method="POST")
    def generate(self, data: dict):
        import base64

        import numpy as np
        import torch
        from fastapi import HTTPException, Response
        from PIL import Image

        # optional auth — token is sent in the request body, checked vs the secret
        token = os.environ.get("SKINMINT_SKIN_TOKEN")
        if token and data.get("token") != token:
            raise HTTPException(status_code=401, detail="unauthorized")

        prompt = (data.get("prompt") or "").strip()
        if not prompt:
            raise HTTPException(status_code=400, detail="prompt is required")
        steps = int(data.get("steps", 25))
        seed = int(data.get("seed", 0))
        generator = torch.Generator("cuda").manual_seed(seed) if seed else None

        init_b64 = data.get("image")
        if init_b64:
            # img2img — condition on an uploaded 立绘 (resized to the model's 768²)
            init = Image.open(io.BytesIO(base64.b64decode(init_b64))).convert("RGB").resize((768, 768))
            strength = float(data.get("strength", 0.65))
            big = self.img2img(
                prompt=prompt,
                image=init,
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=7.5,
                generator=generator,
            ).images[0].convert("RGBA")
        else:
            # Must be 768x768 for this model; larger fills with garbage.
            big = self.pipe(
                prompt,
                num_inference_steps=steps,
                guidance_scale=7.5,
                height=768,
                width=768,
                generator=generator,
            ).images[0].convert("RGBA")

        # The 768 image is the 64x64 skin at 12x — center-sample each 12px block.
        arr = np.array(big)
        small = arr[6::12, 6::12][:64, :64]
        out = io.BytesIO()
        Image.fromarray(small, "RGBA").save(out, format="PNG")
        return Response(content=out.getvalue(), media_type="image/png")
