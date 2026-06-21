import { SkinCanvas } from "./canvas";
import type { SkinOptions, SkinProvider, SkinResult } from "./types";

type RGB = [number, number, number];

const SKINS: RGB[] = [[232, 185, 140], [245, 210, 175], [200, 150, 110], [150, 110, 85]];
const HAIR: RGB[] = [[74, 48, 38], [30, 30, 34], [210, 180, 90], [180, 60, 60], [120, 90, 200], [90, 150, 210]];
const SHIRT: RGB[] = [[59, 111, 184], [200, 70, 70], [70, 160, 90], [220, 180, 70], [120, 80, 180], [90, 90, 100]];
const PANTS: RGB[] = [[43, 58, 103], [60, 45, 40], [40, 70, 50], [80, 80, 90]];

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (h ^ s.charCodeAt(i)) * 16777619;
  return h >>> 0;
};

/**
 * Keyless placeholder provider. Paints a deterministic Minecraft skin whose
 * palette is derived from the prompt — enough to wire and verify the
 * text → skin → model loop before a real generation backend is configured.
 */
export class MockSkinProvider implements SkinProvider {
  readonly name = "mock";

  async generateSkin(prompt: string, options: SkinOptions = {}): Promise<SkinResult> {
    const h = hash(prompt + ":" + (options.seed ?? 0));
    const pick = <T>(arr: T[], shift: number) => arr[(h >>> shift) % arr.length]!;
    const skin = pick(SKINS, 0), hair = pick(HAIR, 4), shirt = pick(SHIRT, 8), pants = pick(PANTS, 12);

    const c = new SkinCanvas();
    // base layer
    c.fillBox(0, 0, 8, 8, 8, skin); // head
    c.fillBox(16, 16, 8, 12, 4, shirt); // body
    c.fillBox(40, 16, 4, 12, 4, skin); // right arm
    c.fillBox(32, 48, 4, 12, 4, skin); // left arm
    c.fillBox(0, 16, 4, 12, 4, pants); // right leg
    c.fillBox(16, 48, 4, 12, 4, pants); // left leg

    // face on head front (8,8)
    c.set(10, 11, 34, 34, 34); c.set(13, 11, 34, 34, 34);
    c.set(10, 12, 34, 34, 34); c.set(13, 12, 34, 34, 34);
    c.rect(11, 14, 2, 1, [160, 90, 74]);

    // hair on the overlay (hat) layer at (32,0); open the front so the face shows
    c.fillBox(32, 0, 8, 8, 8, hair);
    for (let y = 12; y < 16; y++) for (let x = 40; x < 48; x++) c.set(x, y, 0, 0, 0, 0);

    return { png: c.toPNG(), width: 64, height: 64 };
  }
}
