import { describe, it, expect } from "vitest";
import { buildPrompt, STYLES, CHARACTERS } from "../src/index";

describe("buildPrompt", () => {
  it("assembles a clean prompt: subject → accessories (no style/framing words)", () => {
    const r = buildPrompt({
      styleId: "chibi",
      characterId: "ayaka",
      actionId: "apose",
      accessoryIds: ["wings"],
    });
    expect(r.prompt).toBe("Kamisato Ayaka, Genshin Impact, small feathered wings on the back");
  });

  it("carries the style's params and the action's pose mode", () => {
    const r = buildPrompt({ styleId: "voxel", characterId: "klee", actionId: "tpose" });
    expect(r.modelType).toBe("lowpoly");
    expect(r.targetPolycount).toBe(1500);
    expect(r.topology).toBe("quad");
    expect(r.shouldRemesh).toBe(true);
    expect(r.poseMode).toBe("t-pose");
    expect(r.refine).toBe(true);
    expect(r.aiModel).toBe("latest");
  });

  it("uses free-text subject when no character is chosen", () => {
    const r = buildPrompt({ styleId: "lowpoly", subject: "a friendly robot" });
    expect(r.prompt).toBe("a friendly robot");
    expect(r.poseMode).toBe("");
  });

  it("falls back to the first style when styleId is missing", () => {
    const r = buildPrompt({ subject: "a cat" });
    expect(r.modelType).toBe(STYLES[0]!.modelType);
  });

  it("keeps the prompt within Meshy's 600-char limit", () => {
    const r = buildPrompt({
      styleId: "chibi",
      characterId: CHARACTERS[0]!.id,
      accessoryIds: ["wings", "sword", "hat", "cape", "glasses", "base"],
      subject: "x".repeat(800),
    });
    // character wins over subject, but verify the cap regardless
    const long = buildPrompt({ styleId: "chibi", subject: "y".repeat(800) });
    expect(long.prompt.length).toBeLessThanOrEqual(600);
    expect(r.prompt.length).toBeLessThanOrEqual(600);
  });
});
