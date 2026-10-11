// ZPL (PPLZ) PRIMITIVES (EPIC-025-M-01, Logic Plan §4).
//
// Anchors: PD-1/PD-2/PD-3 — Argox O4-250 Pro, 203 dpi, PPLZ, raw TCP socket on port 9100, ALL THREE
//          VERIFIED BY EXECUTION 2026-08-13 (a PPLZ label printed; the equivalent PPLB produced
//          nothing; a raw socket printed end to end over Wi-Fi with no OS driver in the path).
//
// 🔴 THE REPO NAMES THE WRONG PRINTER. `targets/network-printer-target.ts` and
//    `runs/epic-019/99_closeout/` say NTS Q304f / ESC-POS / PrintNode (DECISION-105, 2026-07-22).
//    THAT HARDWARE WAS NEVER BOUGHT. Nothing in this file reads those comments; they are corrected
//    at M-02, in the same commit as the printer master that replaces the variable they describe.
//    A session that trusts the repo over the concept brief builds for the wrong command language.
//
// This is the MINIMUM command set that renders the owner-approved layout, and nothing speculative:
//
//   ^XA / ^XZ          label wrapper
//   ^CI28              UTF-8 input encoding
//   ^PW / ^LL / ^LH    canvas width, length, home origin
//   ^FO x,y            field origin, in dots from the top-left
//   ^A0N,h,0           scalable font 0, normal orientation, height h dots, proportional width
//   ^GB w,h,t          graphic box — the horizontal rules
//   ^BQN,2,<mag>       🔴 THE NATIVE QR: model 2, normal orientation, magnification <mag>
//   ^FH_ / ^FD / ^FS   field data, with hex escaping (see escapeFieldData)
//
// 🔴 THERE IS NO BITMAP COMMAND HERE ON PURPOSE — no ^GF, no ~DG, no ~DY. AC-3 is asserted as an
//    ABSENCE at the boundary: the emitted stream contains no bitmap of any kind while containing
//    exactly one ^BQ. A native QR is sharper at 203 dpi under cold-room lighting than any bitmap
//    the renderer could download, and it is a fraction of the bytes over a raw socket.

// The hex-escape prefix `^FH` installs. `_5F` is therefore how a literal underscore is carried.
const HEX_PREFIX = "_";

// The two characters that can BREAK a `^FD` field: ZPL's command prefixes. `_` is not one of them —
// it only becomes special once `^FH` is switched on, which is why it is not in this test.
const NEEDS_ESCAPE = /[\^~]/;

/** Does this value require the `^FH` hex-escape path at all? */
export function needsHexEscape(value: string): boolean {
  return NEEDS_ESCAPE.test(value);
}

/**
 * Escape a value for `^FD` under `^FH_`.
 *
 * ⚠ `^FD` data is terminated by `^FS`, and the ZPL control prefixes are `^` and `~`. An item name
 *   or a farm batch number carrying a caret would otherwise TRUNCATE THE LABEL SILENTLY — the
 *   printer would read the rest of the value as a command and produce a sticker missing its fields,
 *   with no error anywhere on the wire or in the application.
 *
 * 🔴 THE ESCAPE IS APPLIED ONLY TO A VALUE THAT NEEDS IT, and `^FH` is emitted only alongside it
 *    (see `zplText`). That is deliberate and it is what keeps this safe on BOTH counts:
 *
 *      - An ordinary value — including every slashed farm batch number PD-6a exists for, since `/`
 *        is not a control character — is emitted byte-for-byte as written, so the stream stays
 *        IDENTICAL to the `.zpl` files the owner approved and had printed at the mockup gate. A
 *        printed proof of different bytes proves less.
 *      - The Argox is running PPLZ EMULATION, not native ZPL, and this session cannot put a
 *        `^FH` down a socket to check it — no printer is reachable from here. Emitting `^FH` on
 *        every field would put an unverified command on the one path that is verified to work, on
 *        every label, to protect against a character no live value has. Emitting it only when a
 *        value actually carries a caret or a tilde confines that risk to the case where the
 *        alternative is a silently broken label.
 *
 * `_` is escaped too, but only inside the escaped branch, where `^FH` has made it significant.
 */
export function escapeFieldData(value: string): string {
  return value
    .replace(/_/g, `${HEX_PREFIX}5F`) // first: the prefix itself, or the two below double-escape
    .replace(/\^/g, `${HEX_PREFIX}5E`)
    .replace(/~/g, `${HEX_PREFIX}7E`);
}

/** `^XA` … `^XZ` — one label. */
export function zplLabel(body: readonly string[]): string {
  return [...body, "^XZ"].join("\n") + "\n";
}

/** The canvas preamble: UTF-8 in, then width, length and home origin in dots. */
export function zplCanvas(widthDots: number, heightDots: number): readonly string[] {
  return ["^XA", "^CI28", `^PW${widthDots}`, `^LL${heightDots}`, "^LH0,0"];
}

/** A text field: scalable font 0 at `heightDots`, hex-escaped only when the value needs it. */
export function zplText(x: number, y: number, heightDots: number, value: string): string {
  const field = needsHexEscape(value)
    ? `^FH${HEX_PREFIX}^FD${escapeFieldData(value)}`
    : `^FD${value}`;
  return `^FO${x},${y}^A0N,${heightDots},0${field}^FS`;
}

/** A filled horizontal rule — a graphic box whose border thickness equals its height. */
export function zplRule(x: number, y: number, widthDots: number, thicknessDots: number): string {
  return `^FO${x},${y}^GB${widthDots},${thicknessDots},${thicknessDots}^FS`;
}

/**
 * The native QR (model 2, error correction M, automatic input mode).
 *
 * ⚠ NOT hex-escaped, and that is a measured decision rather than an omission. The only thing this
 *   ever encodes is a pallet code (label-fields.ts `palletLabelQrValue`), and a pallet code is
 *   `<sanitised batch>-NN` with optional `-S<n>` splits — `sanitiseBatchForCode` strips everything
 *   outside [A-Z0-9-], so `^`, `~` and `_` cannot occur in one. Leaving the QR field unescaped
 *   keeps the emitted bytes IDENTICAL to the `.zpl` files the owner approved and printed at the
 *   mockup gate, which is what makes the printed proof a proof of what ships.
 *
 * `magnification` is supplied by the FORMAT and is never defaulted here — see label-format.ts.
 */
export function zplQr(x: number, y: number, magnification: number, value: string): string {
  return `^FO${x},${y}^BQN,2,${magnification}^FDMA,${value}^FS`;
}
