export interface IP {
  id: string;
  name: string;
  available: boolean;
}

export interface Character {
  id: string;
  name: string; // Chinese display name
  ip: string;
  icon: string; // public path
}

export const IPS: IP[] = [
  { id: "genshin", name: "原神", available: true },
  { id: "anime", name: "热门", available: true },
  { id: "zzz", name: "绝区零", available: false },
  { id: "hsr", name: "星穹铁道", available: false },
];

// Skins live at /skinmint/skins/<id>.png (read server-side), icons at /skinmint/icons/<id>.png.
const G = (id: string, name: string): Character => ({ id, name, ip: "genshin", icon: `/skinmint/icons/${id}.png` });

export const CHARACTERS: Character[] = [
  G("hutao", "胡桃"),
  G("ganyu", "甘雨"),
  G("zhongli", "钟离"),
  G("klee", "可莉"),
  G("keqing", "刻晴"),
  G("kazuha", "枫原万叶"),
  G("xiao", "魈"),
  G("venti", "温迪"),
  G("diluc", "迪卢克"),
  G("tartaglia", "达达利亚"),
  G("xingqiu", "行秋"),
  G("xiangling", "香菱"),
  G("qiqi", "七七"),
  G("albedo", "阿贝多"),
  G("amber", "安柏"),
  G("beidou", "北斗"),
  G("bennett", "班尼特"),
  G("chongyun", "重云"),
  G("jean", "琴"),
  G("noelle", "诺艾尔"),
  G("razor", "雷泽"),
  G("sucrose", "砂糖"),
  G("aether", "空"),
  G("lumine", "荧"),
  G("paimon", "派蒙"),
  G("furina", "芙宁娜"),
  // assisted-curation additions (mcskins.top → human-made skins)
  { id: "miku", name: "初音未来", ip: "anime", icon: "/skinmint/icons/miku.png" },
  { id: "nezuko", name: "祢豆子", ip: "anime", icon: "/skinmint/icons/nezuko.png" },
  { id: "gojo", name: "五条悟", ip: "anime", icon: "/skinmint/icons/gojo.png" },
  { id: "frieren", name: "芙莉莲", ip: "anime", icon: "/skinmint/icons/frieren.png" },
  { id: "rem", name: "蕾姆", ip: "anime", icon: "/skinmint/icons/rem.png" },
  { id: "makima", name: "玛奇玛", ip: "anime", icon: "/skinmint/icons/makima.png" },
  { id: "naruto", name: "鸣人", ip: "anime", icon: "/skinmint/icons/naruto.png" },
  { id: "sasuke", name: "佐助", ip: "anime", icon: "/skinmint/icons/sasuke.png" },
  { id: "goku", name: "孙悟空", ip: "anime", icon: "/skinmint/icons/goku.png" },
  { id: "luffy", name: "路飞", ip: "anime", icon: "/skinmint/icons/luffy.png" },
  { id: "zoro", name: "索隆", ip: "anime", icon: "/skinmint/icons/zoro.png" },
  { id: "tanjiro", name: "炭治郎", ip: "anime", icon: "/skinmint/icons/tanjiro.png" },
  { id: "zenitsu", name: "善逸", ip: "anime", icon: "/skinmint/icons/zenitsu.png" },
  { id: "levi", name: "利威尔", ip: "anime", icon: "/skinmint/icons/levi.png" },
  { id: "mikasa", name: "三笠", ip: "anime", icon: "/skinmint/icons/mikasa.png" },
  { id: "anya", name: "阿尼亚", ip: "anime", icon: "/skinmint/icons/anya.png" },
  { id: "megumin", name: "惠惠", ip: "anime", icon: "/skinmint/icons/megumin.png" },
  { id: "2b", name: "2B", ip: "anime", icon: "/skinmint/icons/2b.png" },
  { id: "itachi", name: "宇智波鼬", ip: "anime", icon: "/skinmint/icons/itachi.png" },
  { id: "kakashi", name: "卡卡西", ip: "anime", icon: "/skinmint/icons/kakashi.png" },
  { id: "ichigo", name: "一护", ip: "anime", icon: "/skinmint/icons/ichigo.png" },
  { id: "todoroki", name: "轰焦冻", ip: "anime", icon: "/skinmint/icons/todoroki.png" },
  { id: "bakugo", name: "爆豪", ip: "anime", icon: "/skinmint/icons/bakugo.png" },
  { id: "eren", name: "艾伦", ip: "anime", icon: "/skinmint/icons/eren.png" },
  { id: "link", name: "林克", ip: "anime", icon: "/skinmint/icons/link.png" },
  { id: "mario", name: "马里奥", ip: "anime", icon: "/skinmint/icons/mario.png" },
  { id: "hinata", name: "日向雏田", ip: "anime", icon: "/skinmint/icons/hinata.png" },
  { id: "asuka", name: "明日香", ip: "anime", icon: "/skinmint/icons/asuka.png" },
  { id: "sonic", name: "索尼克", ip: "anime", icon: "/skinmint/icons/sonic.png" },
  { id: "kirby", name: "卡比", ip: "anime", icon: "/skinmint/icons/kirby.png" },
  // assisted-curation batch 2
  { id: "asuna", name: "亚丝娜", ip: "anime", icon: "/skinmint/icons/asuna.png" },
  { id: "emilia", name: "艾米莉亚", ip: "anime", icon: "/skinmint/icons/emilia.png" },
  { id: "yor", name: "约尔", ip: "anime", icon: "/skinmint/icons/yor.png" },
  { id: "killua", name: "奇犽", ip: "anime", icon: "/skinmint/icons/killua.png" },
  { id: "yuji", name: "虎杖悠仁", ip: "anime", icon: "/skinmint/icons/yuji.png" },
  { id: "sukuna", name: "宿傩", ip: "anime", icon: "/skinmint/icons/sukuna.png" },
  { id: "deku", name: "绿谷出久", ip: "anime", icon: "/skinmint/icons/deku.png" },
  { id: "vegeta", name: "贝吉塔", ip: "anime", icon: "/skinmint/icons/vegeta.png" },
  // assisted-curation batch 3 — female, covered + bangs, to disperse the f/skirt collapse
  { id: "shinobu", name: "胡蝶忍", ip: "anime", icon: "/skinmint/icons/shinobu.png" },
  { id: "mitsuri", name: "甘露寺蜜璃", ip: "anime", icon: "/skinmint/icons/mitsuri.png" },
  { id: "yumeko", name: "蛇喰梦子", ip: "anime", icon: "/skinmint/icons/yumeko.png" },
];
