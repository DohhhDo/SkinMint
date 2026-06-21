// Retrieve + recolor approach: instead of pasting 2D 立绘 pixels onto cubes
// (which barely reads as human), start from a proper humanoid skin TEMPLATE
// whose structure already looks like a person, and recolor its regions to the
// character's palette. Structure comes from the template; color from the 立绘.
//
// This file is the parametric template: buildBaseSkin(colors) → a real-looking
// 64×64 skin. The library can grow (more archetypes); this is the first base.

import { ATLAS, FACES, fillFace } from "./mcatlas.mjs";

const clamp = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const shade = ([r, g, b], f) => [clamp(r * f), clamp(g * f), clamp(b * f)];
const idx = (x, y) => (y * ATLAS + x) * 4;

function put(atlas, x, y, [r, g, b], a = 255) {
  const o = idx(x, y);
  atlas[o] = r; atlas[o + 1] = g; atlas[o + 2] = b; atlas[o + 3] = a;
}
// fill a face flat, with a subtle top-light / bottom-shadow gradient for depth.
function fillShaded(atlas, [fx, fy, fw, fh], color) {
  for (let y = 0; y < fh; y++) {
    const f = 1.06 - 0.16 * (y / Math.max(1, fh - 1)); // lighter at top
    const c = shade(color, f);
    for (let x = 0; x < fw; x++) put(atlas, fx + x, fy + y, c);
  }
}

/**
 * @param {{hair:number[],skin:number[],top:number[],bottom:number[],
 *          accent?:number[],shoe?:number[],eye?:number[]}} colors  each [r,g,b]
 * @param {{slim?:boolean}} [opts]
 * @returns {Uint8ClampedArray} 64×64 atlas
 */
export function buildBaseSkin(colors, opts = {}) {
  const hair = colors.hair ?? [60, 45, 40];
  const skin = colors.skin ?? [240, 214, 190];
  const top = colors.top ?? [70, 80, 120];
  const bottom = colors.bottom ?? [50, 55, 80];
  const accent = colors.accent ?? [200, 60, 60];
  const shoe = colors.shoe ?? shade(bottom, 0.6);
  const eye = colors.eye ?? accent;

  const a = new Uint8ClampedArray(ATLAS * ATLAS * 4);
  const skinShade = shade(skin, 0.9);

  // ---------- HEAD ----------
  // hair wraps top/back/sides; front is a face framed by a hair fringe.
  fillShaded(a, FACES.head.top, hair);
  fillShaded(a, FACES.head.back, hair);
  fillShaded(a, FACES.head.left, shade(hair, 0.92));
  fillShaded(a, FACES.head.right, shade(hair, 0.92));
  fillShaded(a, FACES.head.bottom, skinShade);
  // face front: skin base, hair fringe on top 2 rows + side locks, eyes + mouth.
  const [hx, hy, hw, hh] = FACES.head.front;
  for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) {
    let c = skin;
    if (y < 2) c = hair;                              // fringe
    else if (y < 3 && (x === 0 || x === hw - 1)) c = hair; // side locks
    put(a, hx + x, hy + y, c);
  }
  // eyes (rows 4-5), two 1×2 blocks with the eye color + dark top pixel.
  for (const ex of [2, hw - 3]) {
    put(a, hx + ex, hy + 4, shade(eye, 0.5));
    put(a, hx + ex, hy + 5, eye);
  }
  // small mouth hint
  put(a, hx + (hw >> 1), hy + 6, shade(skin, 0.8));

  // ---------- BODY (torso) ----------
  fillShaded(a, FACES.body.front, top);
  fillShaded(a, FACES.body.back, top);
  fillShaded(a, FACES.body.left, shade(top, 0.9));
  fillShaded(a, FACES.body.right, shade(top, 0.9));
  fillShaded(a, FACES.body.top, shade(top, 1.05));
  fillShaded(a, FACES.body.bottom, shade(bottom, 0.9));
  // collar + accent (ribbon/tie) at the chest center-top of the body front.
  const [bx, by, bw] = FACES.body.front;
  for (let x = 0; x < bw; x++) put(a, bx + x, by, shade(top, 0.8)); // collar line
  put(a, bx + (bw >> 1) - 1, by + 1, accent);
  put(a, bx + (bw >> 1), by + 1, accent);
  put(a, bx + (bw >> 1), by + 2, accent);

  // ---------- ARMS (sleeves = top color, hands = skin) ----------
  for (const arm of [FACES.rightArm, FACES.leftArm]) {
    for (const face of ["front", "back", "left", "right"]) fillShaded(a, arm[face], shade(top, 0.96));
    fillShaded(a, arm.top, shade(top, 1.05));
    fillShaded(a, arm.bottom, skin); // hand underside
    // hand: bottom 2 rows of each side face → skin
    for (const face of ["front", "back", "left", "right"]) {
      const [fx, fy, fw, fh] = arm[face];
      for (let y = fh - 2; y < fh; y++) for (let x = 0; x < fw; x++) put(a, fx + x, fy + y, skinShade);
    }
  }

  // ---------- LEGS (bottom color = skirt/pants/tights, feet = shoe) ----------
  for (const leg of [FACES.rightLeg, FACES.leftLeg]) {
    for (const face of ["front", "back", "left", "right"]) fillShaded(a, leg[face], bottom);
    fillShaded(a, leg.top, shade(bottom, 1.05));
    fillShaded(a, leg.bottom, shoe);
    // feet: bottom 2 rows → shoe
    for (const face of ["front", "back", "left", "right"]) {
      const [fx, fy, fw, fh] = leg[face];
      for (let y = fh - 2; y < fh; y++) for (let x = 0; x < fw; x++) put(a, fx + x, fy + y, shoe);
    }
  }

  return a;
}
