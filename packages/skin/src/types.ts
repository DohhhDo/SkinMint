/** A generated 64×64 Minecraft skin (PNG bytes). */
export interface SkinResult {
  /** 64×64 RGBA PNG. */
  png: Uint8Array;
  width: number;
  height: number;
}

export interface SkinOptions {
  /** Deterministic seed where the provider supports it. */
  seed?: number;
  /**
   * Optional init image (PNG/JPEG bytes) for image-to-image — e.g. a character
   * 立绘. Only honored by providers that support img2img (ModalSkinProvider).
   */
  image?: Uint8Array;
  /** img2img denoise strength, 0–1 (higher = follows the prompt more). Default ~0.65. */
  strength?: number;
}

/**
 * Produces a 64×64 Minecraft skin from a text prompt. Swappable backend
 * (mock, Replicate, Civitai, self-hosted) — the rest of SkinMint only depends on
 * this interface, then feeds the skin to `@skinmint/mcmodel`.
 */
export interface SkinProvider {
  readonly name: string;
  generateSkin(prompt: string, options?: SkinOptions): Promise<SkinResult>;
}
