import { describe, it, expect } from "vitest";
import { MockProvider } from "../src/index";

describe("MockProvider", () => {
  it("creates a task and completes after the configured steps", async () => {
    const provider = new MockProvider({ stepsToComplete: 3, glbUrl: "https://x/m.glb" });

    const seen: number[] = [];
    const task = await provider.generate(
      { prompt: "a cute robot" },
      { intervalMs: 1, onProgress: (t) => seen.push(t.progress) },
    );

    expect(task.status).toBe("succeeded");
    expect(task.modelUrls?.glb).toBe("https://x/m.glb");
    expect(task.progress).toBe(100);
    // progress should have been reported and be monotonic up to 100
    expect(seen.at(-1)).toBe(100);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
  });

  it("throws on an unknown task id", async () => {
    const provider = new MockProvider();
    await expect(provider.get("nope")).rejects.toThrow(/Unknown mock task/);
  });
});
