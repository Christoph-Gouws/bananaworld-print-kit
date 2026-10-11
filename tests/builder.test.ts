// The ZPL primitives (CR-DC-227 — moved byte for byte from the DC's `zpl/builder.ts`).
//
// The DC keeps its own end-to-end label suite (`zpl-pallet-label.test.ts`) through its formats; THIS
// suite pins the primitives themselves, so the packhouse can trust them without the DC. Every expected
// string is a WRITTEN value: a test that computed its expectation from the module would pass for any
// change to it.

import { describe, expect, it } from "vitest";

import {
  escapeFieldData,
  needsHexEscape,
  zplCanvas,
  zplLabel,
  zplQr,
  zplRule,
  zplText,
} from "../src/zpl/builder";

describe("escaping — a caret or a tilde would TRUNCATE a label silently", () => {
  it("flags exactly the two ZPL control prefixes, not an underscore on its own", () => {
    expect(needsHexEscape("INC4249/1")).toBe(false);
    expect(needsHexEscape("a^b")).toBe(true);
    expect(needsHexEscape("a~b")).toBe(true);
    expect(needsHexEscape("a_b")).toBe(false);
  });

  it("escapes the prefix first, so the escapes themselves are not double-escaped", () => {
    expect(escapeFieldData("a_b")).toBe("a_5Fb");
    expect(escapeFieldData("a^b")).toBe("a_5Eb");
    expect(escapeFieldData("a~b")).toBe("a_7Eb");
    expect(escapeFieldData("_^~")).toBe("_5F_5E_7E");
  });
});

describe("the minimum command set, byte for byte", () => {
  it("a canvas is UTF-8 in, then width, length and home origin", () => {
    expect(zplCanvas(536, 296)).toEqual(["^XA", "^CI28", "^PW536", "^LL296", "^LH0,0"]);
  });

  it("a label closes with ^XZ and a trailing newline", () => {
    expect(zplLabel(["^XA", "^FO1,1^FDx^FS"])).toBe("^XA\n^FO1,1^FDx^FS\n^XZ\n");
  });

  it("an ordinary value is emitted as written, with NO ^FH (the bytes the owner approved)", () => {
    expect(zplText(16, 10, 46, "INC42491-02")).toBe("^FO16,10^A0N,46,0^FDINC42491-02^FS");
  });

  it("a value carrying a control character gets ^FH_ and the escape, and only then", () => {
    expect(zplText(16, 10, 46, "A^B")).toBe("^FO16,10^A0N,46,0^FH_^FDA_5EB^FS");
  });

  it("a rule is a graphic box whose border thickness equals its height", () => {
    expect(zplRule(16, 62, 504, 2)).toBe("^FO16,62^GB504,2,2^FS");
  });
});

describe("🔴 AC-3 — the QR is native, and there is NO bitmap command anywhere", () => {
  it("is exactly one ^BQ with the supplied magnification (never defaulted here)", () => {
    expect(zplQr(391, 147, 5, "INC42491-02")).toBe("^FO391,147^BQN,2,5^FDMA,INC42491-02^FS");
  });

  it("a whole label built from the primitives contains one ^BQ and no ^GF, ~DG or ~DY", () => {
    const label = zplLabel([
      ...zplCanvas(536, 296),
      zplText(16, 10, 46, "INC42491-02"),
      zplRule(16, 62, 504, 2),
      zplQr(391, 147, 5, "INC42491-02"),
    ]);
    expect(label.match(/\^BQ/g)).toHaveLength(1);
    expect(label).not.toContain("^GF");
    expect(label).not.toContain("~DG");
    expect(label).not.toContain("~DY");
  });
});
