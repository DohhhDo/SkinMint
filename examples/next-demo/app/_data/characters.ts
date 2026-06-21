export interface Character {
  id: string;
  name: string; // Chinese display name
  ip: "genshin" | "anime";
  icon: string; // public path
}

// Skins live at /skinmint/skins/<id>.png (read server-side), icons at /skinmint/icons/<id>.png.
// Every character here ships a curated, hand-made skin — so it is a DIRECT-DOWNLOAD preset (you get a
// ready model), as opposed to the AI-GENERATED path (prompt / upload → a new skin).
const C = (ip: "genshin" | "anime") => (id: string, name: string): Character => ({ id, name, ip, icon: `/skinmint/icons/${id}.png` });
const G = C("genshin");
const A = C("anime");

const GENSHIN: Character[] = [
  G("hutao", "胡桃"), G("ganyu", "甘雨"), G("zhongli", "钟离"), G("klee", "可莉"), G("keqing", "刻晴"),
  G("kazuha", "枫原万叶"), G("xiao", "魈"), G("venti", "温迪"), G("diluc", "迪卢克"), G("tartaglia", "达达利亚"),
  G("xingqiu", "行秋"), G("xiangling", "香菱"), G("qiqi", "七七"), G("albedo", "阿贝多"), G("amber", "安柏"),
  G("beidou", "北斗"), G("bennett", "班尼特"), G("chongyun", "重云"), G("jean", "琴"), G("noelle", "诺艾尔"),
  G("razor", "雷泽"), G("sucrose", "砂糖"), G("aether", "空"), G("lumine", "荧"), G("paimon", "派蒙"), G("furina", "芙宁娜"),
];

const ANIME: Character[] = [
  A("miku", "初音未来"), A("luffy", "路飞"), A("zoro", "索隆"), A("naruto", "漩涡鸣人"), A("sasuke", "宇智波佐助"),
  A("itachi", "宇智波鼬"), A("kakashi", "卡卡西"), A("hinata", "日向雏田"), A("gojo", "五条悟"), A("yuji", "虎杖悠仁"),
  A("sukuna", "宿傩"), A("tanjiro", "炭治郎"), A("nezuko", "祢豆子"), A("zenitsu", "善逸"), A("shinobu", "胡蝶忍"),
  A("mitsuri", "甘露寺蜜璃"), A("deku", "绿谷出久"), A("bakugo", "爆豪胜己"), A("todoroki", "轰焦冻"), A("eren", "艾伦"),
  A("mikasa", "三笠"), A("levi", "利威尔"), A("ichigo", "黑崎一护"), A("goku", "孙悟空"), A("vegeta", "贝吉塔"),
  A("makima", "真纪真"), A("frieren", "芙莉莲"), A("rem", "蕾姆"), A("emilia", "艾米莉亚"), A("megumin", "惠惠"),
  A("asuna", "亚丝娜"), A("asuka", "明日香"), A("2b", "2B"), A("anya", "阿尼亚"), A("yor", "约尔"),
  A("yumeko", "蛇喰梦子"), A("killua", "奇犽"),
];

// One flat, IP-MIXED library. A stable hash-shuffle so the grid isn't "all Genshin first" but stays
// deterministic across SSR/client (no Math.random → no hydration mismatch).
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const CHARACTERS: Character[] = [...GENSHIN, ...ANIME].sort((a, b) => hash(a.id) - hash(b.id));
