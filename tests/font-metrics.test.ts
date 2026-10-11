// The legibility floor and the type fitting (CR-DC-227 — moved byte for byte from the DC's
// `zpl/font-metrics.ts`, so the packhouse inherits the SAME owner-approved minimum, M-01-DEC-01).
//
// 🔴 THE FLOOR VALUES ARE WRITTEN HERE AS NUMBERS ON PURPOSE. They are the owner's, put to them in
//    millimetres at a logic-plan gate; a test that imported them to compare against themselves would
//    stay green for a floor quietly lowered.

import { describe, expect, it } from "vitest";

import {
  LEGIBILITY_FLOOR,
  ZPL_SAFETY_FACTOR,
  fitHeight,
  textWidthDots,
} from "../src/zpl/font-metrics";

describe("the owner-approved floor", () => {
  it("is value 24, caption 16, code 28 and QR module 4 dots at 203 dpi", () => {
    expect(LEGIBILITY_FLOOR).toEqual({ value: 24, caption: 16, code: 28, qrModule: 4 });
  });

  it("keeps the 5 % safety factor the fit claims depend on", () => {
    expect(ZPL_SAFETY_FACTOR).toBe(1.05);
  });
});

describe("textWidthDots", () => {
  it("is the Helvetica advance sum times the height times the safety factor", () => {
    // "0" is 556 units/1000 em, so ten of them at 100 dots: 5.56 em x 100 x 1.05.
    expect(textWidthDots("0000000000", 100)).toBeCloseTo(5.56 * 100 * 1.05, 6);
  });

  it("an unmeasured character falls back to the digit width", () => {
    expect(textWidthDots("é", 100)).toBeCloseTo(textWidthDots("0", 100), 6);
  });
});

describe("fitHeight — shrinks to fit, never below the floor, and says so", () => {
  it("returns the wanted height unchanged when it already fits", () => {
    expect(fitHeight("ABC", 30, 400, 24)).toEqual({
      heightDots: 30,
      shrunk: false,
      overflow: false,
    });
  });

  it("shrinks one dot at a time until the text fits its column", () => {
    const fit = fitHeight("Cavendish Organic Extra", 60, 300, 24);
    expect(fit.shrunk).toBe(true);
    expect(fit.heightDots).toBeGreaterThanOrEqual(24);
    expect(textWidthDots("Cavendish Organic Extra", fit.heightDots)).toBeLessThanOrEqual(300);
  });

  it("🔴 never shrinks past the floor: it reports overflow instead of clipping", () => {
    const fit = fitHeight("Cavendish Organic Extra", 60, 120, 24);
    expect(fit).toEqual({ heightDots: 24, shrunk: true, overflow: true });
  });

  it("🔴 the floor applies to the WANTED height too, not only to the shrinking", () => {
    expect(fitHeight("Cavendish", 10, 400, 24).heightDots).toBe(24);
    expect(fitHeight("ITEM", 6, undefined, 16).heightDots).toBe(16);
  });

  it("an element with no column (undefined) owns as much width as it wants", () => {
    expect(fitHeight("A very long caption indeed", 30, undefined, 16)).toEqual({
      heightDots: 30,
      shrunk: false,
      overflow: false,
    });
  });
});
