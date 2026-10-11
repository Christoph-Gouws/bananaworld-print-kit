// TYPE FITTING AND THE LEGIBILITY FLOOR (EPIC-025-M-01, Logic Plan §4).
//
// Anchors: UX-A11Y-006 (camera-scannable at 30 cm under cold-room lighting), PD-6a, M-01-DEC-01.
//
// 🔴 `LEGIBILITY_FLOOR` IS THE PROJECT'S FIRST WRITTEN MINIMUM TYPE SIZE FOR A PRINTED LABEL
//    (M-01-DEC-01). UX-A11Y-006 fixes the SCAN DISTANCE and has never fixed a type size; PD-6a put
//    six fields and a QR on a 67 x 37 mm canvas and made the question unavoidable. The numbers were
//    put to the owner in millimetres at the logic-plan gate and are binding on every later
//    milestone.
//
// 🔴 NOTHING IS SHRUNK PAST THE FLOOR ON AN AGENT'S AUTHORITY. `fitHeight` stops there. If a value
//    still overflows at the floor the builder does NOT clip and does NOT throw — it emits at the
//    floor and returns the field key in `fitWarnings`, so a real value that ever exceeds the design
//    is a RED TEST rather than a mangled sticker on a pallet.
//
// ⚠ THE FLOOR IS A FLOOR, NOT THE SHIPPED SIZE. Neither format's QR ships at `qrModule` — the owner
//   instructed on 2026-08-16 that it be favoured, so both sit above it (label-format.ts,
//   M-01-DEC-04). AC-3a asserts the shipped magnification and the floor SEPARATELY, because they
//   can fail apart.

// CR-DC-227 — THIS FILE MOVED FROM THE DC (`src/lib/integrations/print/zpl/font-metrics.ts`), byte for
// byte, so the packhouse inherits the SAME owner-approved floor. What did NOT move is `floorForField`:
// it maps the DC's own `PalletLabelFieldKey`, so it stays beside the DC's label fields.

// Dots at 203 dpi. In millimetres, which is how the owner saw them:
//   value   24 dots = 3.00 mm — data an operator reads off the sticker
//   caption 16 dots = 2.00 mm — a fixed word the operator learns once
//   code    28 dots = 3.50 mm — the pallet code, which auto-shrinks when a split code is long
//   qrModule 4 dots = 0.500 mm — what carries the 30 cm read
export const LEGIBILITY_FLOOR = {
  value: 24,
  caption: 16,
  code: 28,
  qrModule: 4,
} as const;

// Helvetica advance widths, units/1000 em. The drawing the owner approved renders in Helvetica and
// ZPL font 0 is a different scalable sans, so these are an ESTIMATE and the printed proof is the
// arbiter (Logic Plan §11.5). Stated rather than dressed up: if the real printhead sets wider, the
// fit constants move and the LAYOUT does not.
const ADVANCE: Readonly<Record<string, number>> = {
  " ": 278,
  "-": 333,
  "/": 278,
  ".": 278,
  ",": 278,
  "(": 333,
  ")": 333,
  "+": 584,
  "0": 556,
  "1": 556,
  "2": 556,
  "3": 556,
  "4": 556,
  "5": 556,
  "6": 556,
  "7": 556,
  "8": 556,
  "9": 556,
  A: 667,
  B: 667,
  C: 722,
  D: 722,
  E: 667,
  F: 611,
  G: 778,
  H: 722,
  I: 278,
  J: 500,
  K: 667,
  L: 556,
  M: 833,
  N: 722,
  O: 778,
  P: 667,
  Q: 778,
  R: 722,
  S: 667,
  T: 611,
  U: 722,
  V: 667,
  W: 944,
  X: 667,
  Y: 667,
  Z: 611,
  a: 556,
  b: 556,
  c: 500,
  d: 556,
  e: 556,
  f: 278,
  g: 556,
  h: 556,
  i: 222,
  j: 222,
  k: 500,
  l: 222,
  m: 833,
  n: 556,
  o: 556,
  p: 556,
  q: 556,
  r: 333,
  s: 500,
  t: 278,
  u: 556,
  v: 500,
  w: 722,
  x: 500,
  y: 500,
  z: 500,
};

// An unmeasured character falls back to the digit width, which is the commonest glyph on a label.
const ADVANCE_FALLBACK = 556;

// ZPL font 0 sets slightly wider than Helvetica at the same nominal height. 5 % of headroom keeps a
// fit CLAIM from turning into an OVERHANG on the real printhead.
export const ZPL_SAFETY_FACTOR = 1.05;

/** Width of a string at a given character height, in dots. */
export function textWidthDots(text: string, heightDots: number): number {
  let em = 0;
  for (const ch of text) {
    /* eslint-disable-next-line security/detect-object-injection -- `ch` indexes a frozen literal
       table with an explicit `??` fallback; a missing key returns undefined, never a prototype
       member, because every value in ADVANCE is a number and the result is used as one. */
    em += (ADVANCE[ch] ?? ADVANCE_FALLBACK) / 1000;
  }
  return em * heightDots * ZPL_SAFETY_FACTOR;
}

export interface FitResult {
  /** The height actually used, in dots. Never below `floor`. */
  readonly heightDots: number;
  /** True when the wanted height did not fit and the value was reduced. */
  readonly shrunk: boolean;
  /** True when the value STILL exceeds its column at the floor — a finding, never a silent clip. */
  readonly overflow: boolean;
}

/**
 * Shrink a value's type height until it fits its column, but never below its floor.
 *
 * `maxWidthDots === undefined` means the element owns as much width as it wants (the pallet code
 * across the top of option A's small label is measured against the full column, so this is only the
 * literal-caption case in practice).
 */
export function fitHeight(
  text: string,
  wantedHeightDots: number,
  maxWidthDots: number | undefined,
  floorDots: number,
): FitResult {
  // 🔴 THE FLOOR APPLIES TO THE WANTED HEIGHT TOO, NOT ONLY TO THE SHRINKING.
  //
  // Until this clamp the loop below simply never ran for a height already at or under the floor, so
  // a template that DECLARED a value at 10 dots got 10 dots and the floor said nothing. A floor
  // that only catches one of the two ways of going under it is not a floor. Nothing in the shipped
  // templates is affected — every declared height is at or above its floor already, and the emitted
  // ZPL is byte-identical to the drawing the owner approved — so this closes a hole rather than
  // changing a label.
  const wanted = Math.max(wantedHeightDots, floorDots);

  if (maxWidthDots === undefined) {
    return { heightDots: wanted, shrunk: false, overflow: false };
  }
  let height = wanted;
  while (height > floorDots && textWidthDots(text, height) > maxWidthDots) {
    height -= 1;
  }
  return {
    heightDots: height,
    shrunk: height < wanted,
    overflow: textWidthDots(text, height) > maxWidthDots,
  };
}
