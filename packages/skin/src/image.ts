import { encodePNG } from "./canvas";

export interface ImageResult {
  png: Uint8Array;
  width: number;
  height: number;
}

export interface ImageRequest {
  /** The (already style-wrapped) generation prompt. */
  prompt: string;
  /** Optional init image for image-to-image (e.g. standardizing an uploaded 立绘). */
  image?: Uint8Array;
  mime?: string;
  /** Provider-specific output size hint, e.g. "1024*1024". */
  size?: string;
}

/**
 * Generates an image from text (and optionally an init image). The core AI
 * capability behind SkinMint: text → a character 立绘, and 立绘 → standardized 立绘.
 * Swappable backend (Qwen / Gemini / self-hosted / mock).
 */
export interface ImageProvider {
  readonly name: string;
  generate(req: ImageRequest): Promise<ImageResult>;
}

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
};
const PAL = {
  hair: [[74, 48, 38], [30, 30, 34], [210, 180, 90], [180, 60, 60], [120, 90, 200], [90, 150, 210]],
  skin: [[238, 205, 180], [245, 220, 195], [210, 170, 140]],
  top: [[59, 111, 184], [200, 70, 70], [70, 160, 90], [220, 180, 70], [120, 80, 180], [60, 60, 70]],
  bottom: [[43, 58, 103], [60, 45, 40], [40, 70, 50], [40, 40, 48]],
} as const;

/**
 * Keyless placeholder — paints a simple anime-ish figure so the
 * text → 立绘 → read → model loop runs with no API key (dev/test).
 */
export class MockImageProvider implements ImageProvider {
  readonly name = "mock-image";

  async generate(req: ImageRequest): Promise<ImageResult> {
    if (req.image) return { png: req.image, width: 0, height: 0 }; // "standardize" = passthrough
    const W = 384, H = 512;
    const buf = new Uint8Array(W * H * 4).fill(255); // white bg
    const h = hash(req.prompt);
    const pick = (arr: readonly (readonly number[])[], sh: number) => arr[(h >>> sh) % arr.length]!;
    const fill = (x: number, y: number, w: number, ht: number, [r, g, b]: readonly number[]) => {
      for (let j = 0; j < ht; j++) for (let i = 0; i < w; i++) {
        const px = x + i, py = y + j;
        if (px < 0 || py < 0 || px >= W || py >= H) continue;
        const o = (py * W + px) * 4;
        buf[o] = r!; buf[o + 1] = g!; buf[o + 2] = b!; buf[o + 3] = 255;
      }
    };
    fill(132, 70, 120, 130, pick(PAL.hair, 0)); // hair
    fill(146, 96, 92, 96, pick(PAL.skin, 8)); // face
    fill(120, 196, 144, 150, pick(PAL.top, 12)); // torso
    fill(132, 346, 120, 150, pick(PAL.bottom, 18)); // legs
    return { png: encodePNG(buf, W, H), width: W, height: H };
  }
}
