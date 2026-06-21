import { animePrompt } from "@skinmint/skin";
import { resolveImageProvider } from "../../_ai/providers";

// Text → a standard anime 立绘 (the AI-necessary entry point). The style is
// locked in code; the user only supplies the character subject. The returned
// 立绘 is shown for confirmation, then drives the same read → paint → model path.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { prompt?: string };
    const subject = String(body.prompt ?? "").trim().slice(0, 300);
    if (!subject) return Response.json({ error: "请输入角色描述" }, { status: 400 });

    const { png } = await resolveImageProvider().generate({ prompt: animePrompt(subject), size: "768*1024" });
    const image = `data:image/png;base64,${Buffer.from(png).toString("base64")}`;
    return Response.json({ image });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "立绘生成失败" }, { status: 500 });
  }
}
