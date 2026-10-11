# `@bananaworld/print-kit`

The shared label-printing primitives for the Bananaworld estate. **Created at CR-DC-227** (packhouse
API-CHG-005) by moving the movable parts of the DC's print stack out of
`src/lib/integrations/print/zpl/` and the DC's two print-agent doors — byte for byte. The DC consumes it;
the packhouse consumes it from its printing epic. Neither may copy it.

Shipped as **TypeScript source** (no build step; consumers add it to Next.js `transpilePackages`). Pure
string building and pure validation: **no database, no socket, no `process.env`**. No barrel — leaf subpaths
only.

| Subpath             | What it is                                                                                             |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `./zpl/builder`     | ZPL (PPLZ) primitives: `zplCanvas`, `zplLabel`, `zplText`, `zplRule`, `zplQr`, `escapeFieldData`.       |
| `./zpl/font-metrics`| The owner-approved **legibility floor** (value 24, caption 16, code 28, QR module 4 dots), `fitHeight`, `textWidthDots`. |
| `./agent-protocol`  | The depot print-agent **wire protocol**: `ClaimedPrintJob`, the claim / report body types, and the pure `parseClaimRequest` / `parseReportRequest`. |

## What is NOT here

Each app keeps its own **spool** (`public.print_job` in the DC), its **label formats** (the field set and
templates), its **printer master and routing**, its **audit hooks**, and its **depot program**. The owner
ruled the spool DC-bound (packhouse `owner-rulings-epic-001.md` §OQ-24). `floorForField` — which maps the
DC's own field keys onto the floors — stays in the DC for the same reason.

## The invariants

- **No bitmap command, ever (AC-3).** The builder has no `^GF` / `~DG` / `~DY`; the QR is a native `^BQ`.
- **A caret or tilde in a value can never truncate a label silently** — it takes the `^FH_` escape, and an
  ordinary value is emitted byte-for-byte as written (so the stream equals what the owner approved).
- **Nothing is shrunk past the floor on an agent's authority.** `fitHeight` stops there and reports
  `overflow`, so a real value that exceeds the design is a red test, not a mangled sticker.
- **`ClaimedPrintJob` is an id, an address, some bytes and a count — nothing else.** The agent holds no
  database credential, and the way that stays true is that this is the only thing it is ever handed.
- **A failed print with no reason is not an outcome.** `parseReportRequest` refuses it; a long reason is
  truncated (500) rather than refused.

The refusal codes and words in `agent-protocol` are the wire contract — the depot agent logs them verbatim.

## Stewardship

Proposed: the DC project stewards the package. A change is an estate change run that names every consumer;
consumers move only by bumping their pinned commit SHA.
