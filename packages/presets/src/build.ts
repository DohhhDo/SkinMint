import { ACCESSORIES, ACTIONS, CHARACTERS, STYLES } from "./data";
import type { BuildResult, PromptSelection } from "./types";

const PROMPT_LIMIT = 600; // Meshy prompt character cap.

const byId = <T extends { id: string }>(list: T[], id?: string) =>
  id ? list.find((x) => x.id === id) : undefined;

/**
 * Assemble a final prompt + generation params from curated presets.
 * Order follows Meshy's formula: subject → add-ons → style → framing.
 * Pure and deterministic — no LLM.
 */
export function buildPrompt(selection: PromptSelection): BuildResult {
  const style = byId(STYLES, selection.styleId) ?? STYLES[0]!;
  const character = byId(CHARACTERS, selection.characterId);
  const action = byId(ACTIONS, selection.actionId);
  const accessories = (selection.accessoryIds ?? [])
    .map((id) => byId(ACCESSORIES, id))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));

  const subject = character?.prompt ?? selection.subject?.trim() ?? "";

  // For Minecraft-skin generation the look is inherent, so we keep the prompt a
  // clean description — no style/voxel/framing words (they hurt the skin model).
  const parts = [
    subject,
    ...accessories.map((a) => a.prompt),
    action?.prompt ?? "",
  ].filter(Boolean);

  let prompt = parts.join(", ");
  if (prompt.length > PROMPT_LIMIT) prompt = prompt.slice(0, PROMPT_LIMIT).replace(/,[^,]*$/, "");

  return {
    prompt,
    refine: style.refine,
    modelType: style.modelType,
    poseMode: action?.poseMode ?? "",
    targetPolycount: style.targetPolycount,
    topology: style.topology,
    shouldRemesh: style.targetPolycount != null,
    aiModel: "latest",
  };
}
