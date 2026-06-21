export type { SkinProvider, SkinResult, SkinOptions } from "./types";
export { SkinCanvas, encodePNG, faceRects } from "./canvas";
export { MockSkinProvider } from "./mock";
export { HFSpaceSkinProvider, type HFSpaceSkinConfig } from "./hfspace";
export { ModalSkinProvider, type ModalSkinConfig } from "./modal";

// ---- AI capability interfaces (the OSS-swappable core) ----
export { type ImageProvider, type ImageRequest, type ImageResult, MockImageProvider } from "./image";
export { type VisionProvider, HFVisionProvider, MockVisionProvider, type HFVisionConfig } from "./vision";
export { QwenImageProvider, type QwenImageConfig } from "./qwen";
export { GeminiImageProvider, type GeminiImageConfig } from "./gemini";

// ---- anime style lock ----
export { ANIME_POSITIVE, ANIME_NEGATIVE, animePrompt } from "./style";

// ---- vision caption + deterministic skin painter ----
export { HFCaptionProvider, captionToSkinPrompt, type ImageCaptioner, type HFCaptionConfig } from "./caption";
export { paintSkinFromPalette, extractSkinPalette, type SkinPalette } from "./paint";
export { renderSkinFromSpec, extractCharacterSpec, type CharacterSpec, type HeadSpec, type HairStyle, type TopType, type BottomType, type Legwear, type Headwear, type Fringe, type HairLength, type EarType, type HornType, type HatType, type HairAccType, type FaceAccType, type Side } from "./spec";
