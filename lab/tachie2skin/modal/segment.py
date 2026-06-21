"""
Anime character segmentation — standalone Modal deployment for lab/tachie2skin.

Why: mode B's local color flood-fill can't separate a character from a
similar-colored background (dark hair on a dark backdrop gets eaten — see the
Amber test). isnet-anime is a model trained specifically to matte anime
characters, so it returns a clean RGBA cutout regardless of background colors.

CPU-only (one image segments in a few seconds), scale-to-zero. The isnet-anime
model is baked into the image at build time so cold starts don't re-download it.

Deploy:
    pip install modal
    modal deploy lab/tachie2skin/modal/segment.py    # prints the web endpoint URL

Then add to lab/tachie2skin/.env (token reuses MODAL_SKIN_TOKEN / 'skinmint-skin'):
    MODAL_SEG_ENDPOINT=<the printed url>
"""

import os

import modal

MODELS_DIR = "/models"
MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/isnet-anime.onnx"

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("rembg[cpu]", "onnxruntime", "pillow", "numpy", "fastapi[standard]")
    .env({"U2NET_HOME": MODELS_DIR, "NUMBA_CACHE_DIR": "/tmp"})
    .run_commands(
        f"mkdir -p {MODELS_DIR}",
        f"python -c \"import urllib.request; urllib.request.urlretrieve('{MODEL_URL}', '{MODELS_DIR}/isnet-anime.onnx')\"",
    )
)

app = modal.App("skinmint-lab-anime-seg")


@app.cls(
    image=image,
    secrets=[modal.Secret.from_name("skinmint-skin")],
    scaledown_window=120,
    timeout=300,
)
class Segmenter:
    @modal.enter()
    def load(self):
        from rembg import new_session

        self.session = new_session("isnet-anime")

    @modal.fastapi_endpoint(method="POST")
    def segment(self, data: dict):
        import base64

        from fastapi import HTTPException, Response
        from rembg import remove

        token = os.environ.get("SKINMINT_SKIN_TOKEN")
        if token and data.get("token") != token:
            raise HTTPException(status_code=401, detail="unauthorized")

        b64 = data.get("image")
        if not b64:
            raise HTTPException(status_code=400, detail="image required")

        # rembg returns RGBA PNG bytes with the background made transparent.
        out = remove(base64.b64decode(b64), session=self.session)
        return Response(content=out, media_type="image/png")
