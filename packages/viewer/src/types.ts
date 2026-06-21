import type { CSSProperties } from "react";

/**
 * Image-based lighting presets supported by drei's <Environment>.
 * Picking one of these controls how the model is lit.
 */
export type EnvironmentPreset =
  | "studio"
  | "city"
  | "sunset"
  | "dawn"
  | "night"
  | "warehouse"
  | "forest"
  | "apartment"
  | "lobby"
  | "park";

/** Layout presets that pick a sensible default height/aspect. */
export type ViewerVariant = "card" | "full";

export interface GeneratedModelViewerProps {
  /**
   * URL of the GLB/glTF model to render. When omitted, a placeholder
   * primitive is shown so the viewer is useful before any model exists.
   */
  modelUrl?: string;

  /** Slowly spin the model. Default: true. */
  autoRotate?: boolean;
  /** Auto-rotation speed (drei OrbitControls units). Default: 1. */
  autoRotateSpeed?: number;

  /** Lighting environment preset. Default: "studio". */
  environment?: EnvironmentPreset;
  /** Render the environment as the scene background. Default: false. */
  showBackground?: boolean;
  /** Solid background color for the canvas (CSS color). Default: transparent. */
  backgroundColor?: string;

  /** Enable orbit/zoom/pan controls. Default: true. */
  showControls?: boolean;
  /** Render the model as a wireframe. Default: false. */
  wireframe?: boolean;
  /** Render a soft contact shadow under the model. Default: true. */
  shadows?: boolean;

  /** Layout preset. Default: "card". */
  variant?: ViewerVariant;
  /** Explicit height override (number = px). Wins over `variant`. */
  height?: number | string;

  /** Use Draco-compressed geometry decoding. Default: true. */
  draco?: boolean;

  className?: string;
  style?: CSSProperties;

  /** Fired once the model's GLB has loaded and been added to the scene. */
  onLoad?: () => void;
  /** Fired if the model fails to load. */
  onError?: (error: unknown) => void;
}
