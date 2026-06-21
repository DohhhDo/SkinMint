export type Topology = "quad" | "triangle";
export type ModelType = "standard" | "lowpoly";
export type PoseMode = "a-pose" | "t-pose" | "";

/** A low-precision art style — carries both prompt wording and Meshy params. */
export interface StylePreset {
  id: string;
  /** Chinese display label. */
  label: string;
  /** English style fragment appended after the subject. */
  prompt: string;
  modelType: ModelType;
  targetPolycount?: number;
  topology?: Topology;
  /** Whether to run the refine (color/texture) pass. */
  refine: boolean;
}

/** A character. Meshy recognizes the character by name, so the prompt is the name. */
export interface CharacterPreset {
  id: string;
  /** Chinese character name (UI label). */
  label: string;
  /** Chinese IP name (grouping). */
  ip: string;
  /** The text that goes into the prompt — the recognized character name. */
  prompt: string;
}

/** A pose / action. Clean poses use Meshy `pose_mode`; others use prompt text. */
export interface ActionPreset {
  id: string;
  label: string;
  poseMode?: PoseMode;
  prompt?: string;
}

/** An optional add-on appended to the subject. */
export interface AccessoryPreset {
  id: string;
  label: string;
  prompt: string;
}

/** What the user selected in the options builder. */
export interface PromptSelection {
  styleId?: string;
  characterId?: string;
  actionId?: string;
  accessoryIds?: string[];
  /** Free-text subject (used when no character is chosen, or as extra detail). */
  subject?: string;
}

/** The assembled prompt + generation params, ready for `useTextTo3D`/the API. */
export interface BuildResult {
  prompt: string;
  refine: boolean;
  modelType: ModelType;
  poseMode: PoseMode;
  targetPolycount?: number;
  topology?: Topology;
  shouldRemesh: boolean;
  aiModel: string;
}
