import { describe, it, expect } from "vitest";
import { MockSkinProvider, SkinCanvas, HFCaptionProvider, captionToSkinPrompt } from "../src/index";

describe("SkinCanvas / encodePNG", () => {
  it("encodes a valid 64×64 PNG (signature + IHDR)", () => {
    const c = new SkinCanvas();
    c.rect(0, 0, 64, 64, [10, 20, 30]);
    const png = c.toPNG();
    expect([...png.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
    expect(Buffer.from(png.slice(12, 16)).toString("ascii")).toBe("IHDR");
    expect(png.byteLength).toBeGreaterThan(100);
  });
});

describe("MockSkinProvider", () => {
  it("returns a 64×64 PNG", async () => {
    const r = await new MockSkinProvider().generateSkin("a knight");
    expect(r.width).toBe(64);
    expect(r.height).toBe(64);
    expect(Buffer.from(r.png.slice(1, 4)).toString("ascii")).toBe("PNG");
  });

  it("is deterministic for the same prompt, varies across prompts", async () => {
    const p = new MockSkinProvider();
    const a1 = await p.generateSkin("a knight");
    const a2 = await p.generateSkin("a knight");
    const b = await p.generateSkin("a wizard in red");
    expect(Buffer.from(a1.png).equals(Buffer.from(a2.png))).toBe(true);
    expect(Buffer.from(a1.png).equals(Buffer.from(b.png))).toBe(false);
  });
});

describe("HFCaptionProvider / captionToSkinPrompt", () => {
  it("composes a clean skin prompt from a noisy caption", () => {
    const p = captionToSkinPrompt("a drawing of a girl with brown hair and a red hat");
    expect(p.startsWith("minecraft skin of a character,")).toBe(true);
    expect(p).not.toMatch(/\bdrawing\b/);
    expect(p).toContain("girl with brown hair");
  });

  it("requires an HF token", () => {
    expect(() => new HFCaptionProvider({})).toThrow(/hfToken/);
  });

  it("sends a vision-chat request with the image and returns the caption (stubbed fetch)", async () => {
    let sentBody: any;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sentBody = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ choices: [{ message: { content: "a blue robot" } }] }), { status: 200 });
    }) as unknown as typeof fetch;
    const cap = new HFCaptionProvider({ hfToken: "hf_x", fetch: fakeFetch });
    const text = await cap.caption(new Uint8Array([1, 2, 3]));
    expect(text).toBe("a blue robot");
    // the image rides along as a data URL in the chat content
    const parts = sentBody.messages[0].content;
    expect(parts.find((p: any) => p.type === "image_url").image_url.url).toMatch(/^data:image\/png;base64,/);
  });
});

describe("paintSkinFromPalette / extractSkinPalette", () => {
  it("paints a valid 64×64 PNG from a palette", async () => {
    const { paintSkinFromPalette } = await import("../src/index");
    const png = paintSkinFromPalette({ hair: "#1a1a1a", skin: "#f0e0d0", eyes: "#cc2222", top: "#d62929", bottom: "#222", shoes: "#000" });
    expect([...png.slice(0, 4)]).toEqual([137, 80, 78, 71]); // PNG signature
    expect(png.byteLength).toBeGreaterThan(100);
  });

  it("extracts a palette from the vision model's JSON (stubbed fetch)", async () => {
    const { extractSkinPalette } = await import("../src/index");
    const fakeFetch = (async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'sure: {"hair":"#111111","skin":"#eedd","top":"#ff0000"}' } }] }), { status: 200 })) as unknown as typeof fetch;
    const p = await extractSkinPalette(new Uint8Array([1]), { hfToken: "hf_x", fetch: fakeFetch });
    expect(p.hair).toBe("#111111");
    expect(p.top).toBe("#ff0000");
    expect(p.skin).toBe("#e8b98c"); // "#eedd" invalid → fallback
  });
});

describe("ImageProvider / VisionProvider (P0 AI layer)", () => {
  it("MockImageProvider paints a placeholder 立绘 PNG from text", async () => {
    const { MockImageProvider } = await import("../src/index");
    const r = await new MockImageProvider().generate({ prompt: "a red knight" });
    expect([...r.png.slice(0, 4)]).toEqual([137, 80, 78, 71]);
    expect(r.width).toBeGreaterThan(0);
  });

  it("QwenImageProvider does text2img on qwen-image (stubbed fetch)", async () => {
    const { QwenImageProvider } = await import("../src/index");
    let sent: any;
    const fakeFetch = (async (url: string, init?: RequestInit) => {
      if (init?.body) {
        sent = JSON.parse(String(init.body));
        return new Response(JSON.stringify({ output: { choices: [{ message: { content: [{ image: "https://x/y.png" }] } }] } }), { status: 200 });
      }
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 }); // the image fetch
    }) as unknown as typeof fetch;
    const p = new QwenImageProvider({ apiKey: "sk-x", fetch: fakeFetch });
    const r = await p.generate({ prompt: "anime girl" });
    expect(sent.model).toBe("qwen-image"); // text2img model
    expect(sent.input.messages[0].content).toEqual([{ text: "anime girl" }]); // no image
    expect([...r.png.slice(0, 4)]).toEqual([137, 80, 78, 71]);
  });

  it("QwenImageProvider switches to qwen-image-edit when given an init image", async () => {
    const { QwenImageProvider } = await import("../src/index");
    let sent: any;
    const fakeFetch = (async (_url: string, init?: RequestInit) => {
      if (init?.body) { sent = JSON.parse(String(init.body)); return new Response(JSON.stringify({ output: { choices: [{ message: { content: [{ image: "https://x/y.png" }] } }] } }), { status: 200 }); }
      return new Response(new Uint8Array([137, 80, 78, 71]), { status: 200 });
    }) as unknown as typeof fetch;
    await new QwenImageProvider({ apiKey: "sk-x", fetch: fakeFetch }).generate({ prompt: "p", image: new Uint8Array([1, 2]) });
    expect(sent.model).toBe("qwen-image-edit");
    expect(sent.input.messages[0].content.length).toBe(2); // image + text
  });

  it("MockVisionProvider returns a parseable palette JSON", async () => {
    const { MockVisionProvider } = await import("../src/index");
    const t = await new MockVisionProvider().read(new Uint8Array([1, 2, 3]), "palette?");
    expect(() => JSON.parse(t)).not.toThrow();
    expect(JSON.parse(t).hair).toMatch(/^#/);
  });

  it("animePrompt locks the anime style", async () => {
    const { animePrompt, ANIME_POSITIVE } = await import("../src/index");
    const p = animePrompt("a red knight");
    expect(p.startsWith(ANIME_POSITIVE)).toBe(true);
    expect(p).toContain("a red knight");
  });
});
