import type { AccessoryPreset, ActionPreset, CharacterPreset, StylePreset } from "./types";

/** Appended to every prompt for a clean, single-object, riggable asset. */
export const FRAMING = "full body, single character, plain background, game asset, 3D model";

/** The few low-precision styles (no realistic / high-detail). */
export const STYLES: StylePreset[] = [
  {
    id: "chibi",
    label: "Q版迷你",
    prompt: "chibi, big head small body, cute miniature collectible figurine, smooth rounded shapes, soft colors",
    modelType: "lowpoly",
    targetPolycount: 6000,
    topology: "quad",
    refine: true,
  },
  {
    id: "voxel",
    label: "体素 / 我的世界",
    prompt: "voxel art, blocky cubic style, pixelated low resolution, flat solid colors, Minecraft-like",
    modelType: "lowpoly",
    targetPolycount: 1500,
    topology: "quad",
    refine: true,
  },
  {
    id: "lowpoly",
    label: "低多边形",
    prompt: "low-poly, faceted, flat-shaded, clean geometric shapes, stylized game-ready asset",
    modelType: "lowpoly",
    targetPolycount: 4000,
    topology: "quad",
    refine: true,
  },
  {
    id: "cartoon",
    label: "卡通",
    prompt: "cartoon, simple bold shapes, vibrant flat colors, cute stylized look",
    modelType: "standard",
    targetPolycount: 12000,
    topology: "triangle",
    refine: true,
  },
];

/** Characters — Meshy recognizes these by name, so the prompt is just the name. */
export const CHARACTERS: CharacterPreset[] = [
  {
    id: "raiden",
    label: "雷电将军",
    ip: "原神",
    prompt: "Raiden Shogun, Genshin Impact",
  },
  {
    id: "ganyu",
    label: "甘雨",
    ip: "原神",
    prompt: "Ganyu, Genshin Impact",
  },
  {
    id: "hutao",
    label: "胡桃",
    ip: "原神",
    prompt: "Hu Tao, Genshin Impact",
  },
  {
    id: "zhongli",
    label: "钟离",
    ip: "原神",
    prompt: "Zhongli, Genshin Impact",
  },
  {
    id: "ayaka",
    label: "神里绫华",
    ip: "原神",
    prompt: "Kamisato Ayaka, Genshin Impact",
  },
  {
    id: "klee",
    label: "可莉",
    ip: "原神",
    prompt: "Klee, Genshin Impact",
  },
  {
    id: "paimon",
    label: "派蒙",
    ip: "原神",
    prompt: "Paimon, Genshin Impact",
  },
  {
    id: "keqing",
    label: "刻晴",
    ip: "原神",
    prompt: "Keqing, Genshin Impact",
  },
  {
    id: "mona",
    label: "莫娜",
    ip: "原神",
    prompt: "Mona, Genshin Impact",
  },
  {
    id: "venti",
    label: "温迪",
    ip: "原神",
    prompt: "Venti, Genshin Impact",
  },
  {
    id: "diluc",
    label: "迪卢克",
    ip: "原神",
    prompt: "Diluc, Genshin Impact",
  },
  {
    id: "yaemiko",
    label: "八重神子",
    ip: "原神",
    prompt: "Yae Miko, Genshin Impact",
  },
  {
    id: "yoimiya",
    label: "宵宫",
    ip: "原神",
    prompt: "Yoimiya, Genshin Impact",
  },
  {
    id: "nahida",
    label: "纳西妲",
    ip: "原神",
    prompt: "Nahida, Genshin Impact",
  },
  {
    id: "xiao",
    label: "魈",
    ip: "原神",
    prompt: "Xiao, Genshin Impact",
  },
  {
    id: "kazuha",
    label: "枫原万叶",
    ip: "原神",
    prompt: "Kaedehara Kazuha, Genshin Impact",
  },
  {
    id: "shenhe",
    label: "申鹤",
    ip: "原神",
    prompt: "Shenhe, Genshin Impact",
  },
  {
    id: "itto",
    label: "荒泷一斗",
    ip: "原神",
    prompt: "Arataki Itto, Genshin Impact",
  },
  {
    id: "kokomi",
    label: "珊瑚宫心海",
    ip: "原神",
    prompt: "Sangonomiya Kokomi, Genshin Impact",
  },
  {
    id: "qiqi",
    label: "七七",
    ip: "原神",
    prompt: "Qiqi, Genshin Impact",
  },
  {
    id: "xiangling",
    label: "香菱",
    ip: "原神",
    prompt: "Xiangling, Genshin Impact",
  },
  {
    id: "ningguang",
    label: "凝光",
    ip: "原神",
    prompt: "Ningguang, Genshin Impact",
  },
  {
    id: "xingqiu",
    label: "行秋",
    ip: "原神",
    prompt: "Xingqiu, Genshin Impact",
  },
  {
    id: "fischl",
    label: "菲谢尔",
    ip: "原神",
    prompt: "Fischl, Genshin Impact",
  },
  {
    id: "eula",
    label: "优菈",
    ip: "原神",
    prompt: "Eula, Genshin Impact",
  },
  {
    id: "ayato",
    label: "神里绫人",
    ip: "原神",
    prompt: "Kamisato Ayato, Genshin Impact",
  },
  {
    id: "baizhu",
    label: "白术",
    ip: "原神",
    prompt: "Baizhu, Genshin Impact",
  },
  {
    id: "yelan",
    label: "夜兰",
    ip: "原神",
    prompt: "Yelan, Genshin Impact",
  },
];

/** Poses / actions. */
export const ACTIONS: ActionPreset[] = [
  { id: "apose", label: "A 字姿势", poseMode: "a-pose" },
  { id: "tpose", label: "T 字姿势", poseMode: "t-pose" },
  { id: "stand", label: "自然站立", poseMode: "", prompt: "standing relaxed pose" },
  { id: "battle", label: "战斗姿态", poseMode: "", prompt: "dynamic battle stance" },
  { id: "sit", label: "坐姿", poseMode: "", prompt: "sitting pose" },
];

/** Optional add-ons. */
export const ACCESSORIES: AccessoryPreset[] = [
  { id: "wings", label: "翅膀", prompt: "small feathered wings on the back" },
  { id: "sword", label: "刀剑", prompt: "holding a sword" },
  { id: "hat", label: "帽子", prompt: "wearing a cute hat" },
  { id: "cape", label: "披风", prompt: "wearing a flowing cape" },
  { id: "glasses", label: "眼镜", prompt: "wearing glasses" },
  { id: "base", label: "底座", prompt: "standing on a small round display base" },
];
