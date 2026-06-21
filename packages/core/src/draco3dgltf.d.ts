declare module "draco3dgltf" {
  /** Returns a Draco decoder module (used by glTF-Transform's NodeIO). */
  export function createDecoderModule(object?: unknown): Promise<unknown>;
  /** Returns a Draco encoder module (used by glTF-Transform's NodeIO). */
  export function createEncoderModule(object?: unknown): Promise<unknown>;
}
