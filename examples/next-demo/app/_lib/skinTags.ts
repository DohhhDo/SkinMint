// Structural tags for the curated base skins, used to retrieve a base whose
// silhouette matches the input — recolor fixes colors, but it can't turn a skirt
// into trousers, nor split a one-piece kimono into a separate top + bottom. So we
// pick the right shape first. Hand-labelled (more reliable than a VLM for known
// characters). gender: m|f|n. lower: pants | skirt (two-piece) | dress (one-piece).
export type Gender = "m" | "f" | "n";
export type Lower = "pants" | "skirt" | "dress";
export const SKIN_TAGS: Record<string, [Gender, Lower]> = {
  // Genshin
  hutao: ["f", "dress"], ganyu: ["f", "pants"], zhongli: ["m", "pants"], klee: ["f", "dress"],
  keqing: ["f", "skirt"], kazuha: ["m", "pants"], xiao: ["m", "pants"], venti: ["m", "pants"],
  diluc: ["m", "pants"], tartaglia: ["m", "pants"], xingqiu: ["m", "pants"], xiangling: ["f", "skirt"],
  qiqi: ["f", "dress"], albedo: ["m", "pants"], amber: ["f", "pants"], beidou: ["f", "pants"],
  bennett: ["m", "pants"], chongyun: ["m", "pants"], jean: ["f", "skirt"], noelle: ["f", "skirt"],
  razor: ["m", "pants"], sucrose: ["f", "dress"], aether: ["m", "pants"], lumine: ["f", "dress"],
  paimon: ["f", "dress"], furina: ["f", "dress"],
  // anime / games
  miku: ["f", "skirt"], nezuko: ["f", "dress"], gojo: ["m", "pants"], frieren: ["f", "dress"],
  rem: ["f", "skirt"], makima: ["f", "pants"], naruto: ["m", "pants"], sasuke: ["m", "pants"],
  goku: ["m", "pants"], luffy: ["m", "pants"], zoro: ["m", "pants"], tanjiro: ["m", "pants"],
  zenitsu: ["m", "pants"], levi: ["m", "pants"], mikasa: ["f", "pants"], anya: ["f", "skirt"],
  megumin: ["f", "dress"], "2b": ["f", "dress"], itachi: ["m", "pants"], kakashi: ["m", "pants"],
  ichigo: ["m", "pants"], todoroki: ["m", "pants"], bakugo: ["m", "pants"], eren: ["m", "pants"],
  link: ["m", "pants"], mario: ["m", "pants"], hinata: ["f", "pants"], asuka: ["f", "pants"],
  sonic: ["m", "pants"], kirby: ["n", "pants"],
  // batch 2
  asuna: ["f", "skirt"], emilia: ["f", "dress"], yor: ["f", "dress"], killua: ["m", "pants"],
  yuji: ["m", "pants"], sukuna: ["m", "pants"], deku: ["m", "pants"], vegeta: ["m", "pants"],
  // batch 3 — female, covered + bangs (f/skirt variety to disperse the rem collapse)
  shinobu: ["f", "skirt"], mitsuri: ["f", "skirt"], yumeko: ["f", "skirt"],
};
