// Core head-accessory stencils. Each stamps a clean, blocky shape onto the head's
// two-layer cube via a `set(x,y,rgb)` callback in ABSOLUTE 64×64 skin coords. The VLM
// decides WHICH stencil + the color + the side; these provide the readable SHAPE the
// blurry front-projection can't. All accessories live on the OVERLAY (hat) layer so they
// float just outside the base cube and read from front + 3/4 angles.
//
// Head UV rects (standard MC 64×64):
//   base:    top[8,0] right[0,8] front/face[8,8] left[16,8] back[24,8] bottom[16,0]
//   overlay: top[40,0] right[32,8] front[40,8] left[48,8] back[56,8] bottom[48,0]
// Top-face orientation: row y=max edge = FRONT of head, y=min = BACK; x preserved L↔R.

export type RGB = [number, number, number];
export type Setter = (x: number, y: number, c: RGB) => void;

const sh = ([r, g, b]: RGB, f: number): RGB => [Math.min(255, r * f) | 0, Math.min(255, g * f) | 0, Math.min(255, b * f) | 0];
const lighten = ([r, g, b]: RGB, f: number): RGB => [Math.min(255, r + (255 - r) * f) | 0, Math.min(255, g + (255 - g) * f) | 0, Math.min(255, b + (255 - b) * f) | 0];

// overlay rect origins
const OT = [40, 0]; // overlay top
const OF = [40, 8]; // overlay front
const OR = [32, 8]; // overlay right side
const OL = [48, 8]; // overlay left side
const OB = [56, 8]; // overlay back

/** Animal ears — VERTICAL nubs at the top-front corners (front + side overlay faces), so they
 *  stand up off the head instead of lying flat on the top "lid". */
export function paintEars(set: Setter, color: RGB, type: "cat" | "fox" | "rabbit" | "other"): void {
  const inner = lighten(color, 0.45);
  const tall = type === "rabbit" ? 4 : type === "fox" ? 3 : 2; // ear height in rows down the front overlay
  for (const [cIn, cOut] of [[1, 0], [6, 7]] as const) { // [inner col, outer col] for left & right ear
    for (let j = 0; j < tall; j++) { set(OF[0]! + cIn, OF[1]! + j, color); set(OF[0]! + cOut, OF[1]! + j, color); }
    set(OF[0]! + cIn, OF[1]! + 1, inner); // inner-ear highlight
  }
  // wrap onto the side-overlay top corners + top-face front corners → reads from 3/4 and above too
  for (let j = 0; j < tall; j++) { set(OR[0]! + 7, OR[1]! + j, color); set(OL[0]! + 0, OL[1]! + j, color); }
  for (const c of [0, 1, 6, 7]) set(OT[0]! + c, OT[1]! + 7, color);
}

/** Horns — small tapered points rising from the forehead corners. */
export function paintHorns(set: Setter, color: RGB, type: "demon" | "oni" | "other"): void {
  const tip = sh(color, 0.8);
  // base on the front-overlay top corners, tapering up onto the top overlay front row
  for (const side of [0, 1] as const) {
    const fx = side === 0 ? OF[0]! + 1 : OF[0]! + 6; // front-overlay column
    const tx = side === 0 ? OT[0]! + 1 : OT[0]! + 6; // top-overlay column (curls back over the top)
    set(fx, OF[1]!, color); set(fx, OF[1]! + 1, color);
    set(tx, OT[1]! + 7, color); set(tx, OT[1]! + 6, tip);
    if (type === "oni") { set(fx + (side === 0 ? -1 : 1), OF[1]!, color); set(tx, OT[1]! + 5, tip); } // thicker/taller oni
  }
}

/** Hat / cap / beret — covers the crown (top+sides+back overlay) + a front brim. */
export function paintHat(set: Setter, color: RGB, type: "hat" | "cap" | "beret"): void {
  const dark = sh(color, 0.82), brim = sh(color, 0.7);
  const fill = (ox: number, oy: number, w: number, h: number, c: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(ox + i, oy + j, c); };
  fill(OT[0]!, OT[1]!, 8, 8, color); // crown top
  fill(OB[0]!, OB[1]!, 8, type === "beret" ? 6 : 4, dark); // back of the hat
  fill(OR[0]!, OR[1]!, 8, type === "beret" ? 5 : 3, dark); // right band
  fill(OL[0]!, OL[1]!, 8, type === "beret" ? 5 : 3, dark); // left band
  const brimRows = type === "cap" ? 2 : type === "beret" ? 4 : 3;
  fill(OF[0]!, OF[1]!, 8, brimRows, brim); // brim over the forehead
  if (type === "beret") set(OT[0]! + 4, OT[1]! + 1, lighten(color, 0.4)); // stalk
}

/** Hood — like a hat but frames the face (sides of the front overlay), face stays open. */
export function paintHood(set: Setter, color: RGB): void {
  const dark = sh(color, 0.8);
  const fill = (ox: number, oy: number, w: number, h: number, c: RGB) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) set(ox + i, oy + j, c); };
  fill(OT[0]!, OT[1]!, 8, 8, color);
  fill(OB[0]!, OB[1]!, 8, 8, dark);
  fill(OR[0]!, OR[1]!, 8, 8, dark);
  fill(OL[0]!, OL[1]!, 8, 8, dark);
  // frame the face: top row + outer columns of the front overlay
  for (let i = 0; i < 8; i++) set(OF[0]! + i, OF[1]!, color);
  for (let j = 0; j < 8; j++) { set(OF[0]!, OF[1]! + j, color); set(OF[0]! + 7, OF[1]! + j, color); }
}

/** Headband — a thin band across the forehead hairline (top of the front overlay). */
export function paintBand(set: Setter, color: RGB): void {
  for (let i = 0; i < 8; i++) set(OF[0]! + i, OF[1]!, color);
  for (let i = 0; i < 8; i++) set(OF[0]! + i, OF[1]! + 1, sh(color, 0.85));
}

/** Bow / ribbon — a two-loop knot on the chosen side of the head. */
export function paintBow(set: Setter, color: RGB, side: "left" | "right" | "center" | "both"): void {
  const knot = sh(color, 0.7);
  const stamp = (cx: number) => {
    // 3-wide, 2-tall bow on the top-overlay front rows, with a darker center knot
    for (const [dx, dy] of [[0, 0], [2, 0], [0, 1], [2, 1]] as const) set(OT[0]! + cx + dx, OT[1]! + 6 + dy, color);
    set(OT[0]! + cx + 1, OT[1]! + 6, knot); set(OT[0]! + cx + 1, OT[1]! + 7, knot);
  };
  if (side === "left" || side === "both") stamp(0);
  if (side === "right" || side === "both") stamp(5);
  if (side === "center") stamp(3);
}

/** Crown / tiara — a banded base with points across the top-front. */
export function paintCrown(set: Setter, color: RGB): void {
  const gem = lighten(color, 0.3);
  for (let i = 0; i < 8; i++) set(OF[0]! + i, OF[1]!, color); // band on the forehead
  for (const c of [0, 2, 4, 6]) set(OT[0]! + c, OT[1]! + 7, color); // points rising on the top front row
  set(OF[0]! + 3, OF[1]!, gem); set(OF[0]! + 4, OF[1]!, gem); // center gem
}

/** Glasses / eyepatch — over the eyes on the front overlay (base face shows through elsewhere). */
export function paintFaceAcc(set: Setter, color: RGB, type: "glasses" | "eyepatch" | "mask", eyeRow: number): void {
  const y = OF[1]! + Math.max(2, Math.min(6, eyeRow)); // align to the detected eye row within the face
  if (type === "glasses") {
    for (const c of [1, 2, 5, 6]) set(OF[0]! + c, y, color); // two lenses
    set(OF[0]! + 3, y, color); set(OF[0]! + 4, y, color); // bridge
  } else if (type === "eyepatch") {
    for (let j = -1; j <= 1; j++) for (const c of [4, 5, 6]) set(OF[0]! + c, y + j, color); // block over the right eye
    for (let i = 0; i < 8; i++) set(OF[0]! + i, OF[1]! + 1, sh(color, 0.9)); // strap
  } else {
    for (let j = 0; j <= 2; j++) for (let i = 1; i < 7; i++) set(OF[0]! + i, y + 1 + j, color); // mouth mask, lower face
  }
}
