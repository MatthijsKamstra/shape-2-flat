# Copilot Guide

Small Node.js CLI that converts an input SVG path (or rect/polygon/polyline/circle/ellipse) into a printable A4 SVG “net” of an extruded prism. Output groups are `SHAPE`, `GLUE`, `FOLDING_LINES`, and `DESIGN`.

## Architecture & Data Flow

- Entry (`bin/shape-2-flat.js`): Parses CLI flags via `yargs`, reads `--input` SVG or `--path` string, then calls `generateNet` from `src/core.mjs` and writes the resulting SVG to `--output`.
- Orchestration (`src/core.mjs`):
  - `extractPathInfo` (`src/svg-io.mjs`) → prefer `<path>`, also supports `rect`/`circle`/`ellipse`/`polygon`/`polyline`.
  - `flattenPath` + `simplifyColinear` (`src/path-flatten.mjs`) → polygon points.
  - `makeNet` (`src/net.mjs`) → base, mirrored base, side rectangles from edge lengths; merges tiny segments via `minSegment`.
  - `renderNetSvg` (`src/render.mjs`) → A4 SVG with groups `GLUE`, `SHAPE`, `FOLDING_LINES`, `DESIGN`.

## Layout Rules (What to preserve)

- Rotate base so the longest edge is vertical (see `makeNet`).
- Side rectangles: one per (merged) edge with `width = depth`, `height = edge length`, stacked vertically between Base and Mirror.
- Mirrored base: horizontal mirror placed to the right of the side stack, aligned along the same edge span.
- No gaps between parts (`gap = 0` in `render.mjs`).
- Centering uses the bounds of `SHAPE` and side stack only; `GLUE`/`FOLDING_LINES` do not influence layout.
- Circle/Ellipse placement: base is tangent‑aligned at its rightmost point to the side stack; mirrored base tangent‑aligned at its leftmost point.
- Primitives (rect/circle/ellipse) are preserved in SHAPE and not converted to paths.

## Styles & Grouping

- `SHAPE`: white fill, black stroke (`stroke-width=0.6`).
- `GLUE`: 7 mm tabs with 45° angled ends on all four sides; for circles/ellipses, vertical seams use saw‑tooth triangular tabs; gray fill (`#e5e5e5`), no stroke.
- `FOLDING_LINES`: dashed fold lines along tab seams; white stroke (`#FFF`), `stroke-dasharray="2,1"`.
- `DESIGN`: reserved for overlays; includes a perimeter text label for validation. Page background is white.

## Page & Units

- A4 canvas set in `src/core.mjs` via `renderNetSvg(..., { page: { width: 210, height: 297 } })`.
- Output `width`/`height` use `--unit` suffix (`mm` default). Geometry uses the same unit scale; convert externally if needed.

## CLI Flags (bin/shape-2-flat.js)

- `--input, -i`: SVG file path (uses first `<path>`; fallbacks supported).
- `--path, -p`: SVG path data string.
- `--depth, -d`: Extrusion depth (default 50). `--height` is deprecated alias.
- `--scale, -s`: Multiply input coordinates (default 1).
- `--tolerance, -t`: Path sampling step (smaller → more segments; default 0.5).
- `--min-segment, -ms`: Merge edges shorter than this into the previous (default 0.5).
- `--margin, -m`: Margin around content before centering (default 10).
- `--unit, -u`: Output unit suffix (`px`, `mm`; default `mm`).
- `--output, -o`: Output SVG file (default `assets/net.svg`).

## Developer Workflows

- Install and run locally:
  - `npm install`
  - `npm start` (runs the CLI) or `node bin/shape-2-flat.js --help`
- Minimal examples:
  - `node bin/shape-2-flat.js --path "M0,0 L100,0 L100,50 L0,50 Z" --depth 30 --unit mm --output export/net.svg`
  - `node bin/shape-2-flat.js --input originals/boxy_plain.svg --depth 40 --tolerance 0.5 --output export/net.svg`

## External Dependencies

- `svg-path-properties`: sampling path geometry for flattening.
- `@xmldom/xmldom` + `xpath`: parse and query SVG for `<path>`/`rect`/`polygon`.
- `yargs`: CLI parsing (`.strict()` enabled).
- `svgpath`: apply and bake transforms into path `d` data when present.

## Common Prompt Targets (quick references)

- “Rotate base so longest edge is vertical.” → `makeNet` in `src/net.mjs`.
- “Make side rectangles match edge lengths and depth.” → `sideRects` in `src/net.mjs`.
- “Keep white fill, black stroke.” → `baseStyle`/`extrudeStyle` in `src/render.mjs`.
- “Connect shapes without gaps.” → `gap = 0` in `src/render.mjs`.
- “Fold lines group id?” → `FOLDING_LINES` in `src/render.mjs` (dashed white).
- “Preserve rect/circle/ellipse primitives.” → `extractPathInfo` in `src/svg-io.mjs` and primitive rendering in `src/render.mjs`.
- “Saw‑tooth tabs for curved seams.” → vertical seams for circles/ellipses in `src/render.mjs` (GLUE group).
- “Perimeter overlay text?” → `DESIGN` group in `src/render.mjs`.

## Editing Guidelines

- Prefer small, focused changes; keep defaults sensible.
- If behavior changes, update `README.md` and reflect actual groups (`FOLDING_LINES`).
- Add new CLI options only when necessary; thread them through `bin → src/core.mjs → render/makeNet` consistently.
