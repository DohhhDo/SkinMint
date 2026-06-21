import { useGLTF } from "@react-three/drei";

export { GeneratedModelViewer } from "./GeneratedModelViewer";
export type {
  GeneratedModelViewerProps,
  EnvironmentPreset,
  ViewerVariant,
} from "./types";

/**
 * Warm the GLTF cache for a model URL so it appears instantly when mounted.
 * Call from an event handler or effect before showing the viewer.
 */
export function preloadModel(url: string, draco = true): void {
  useGLTF.preload(url, draco);
}
