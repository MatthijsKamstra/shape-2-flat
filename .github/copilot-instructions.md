# Copilot Guide

## Purpose & Output
- Node CLI (`bin/shape-2-flat.js`) turns SVG paths or primitives into A4 printable prism nets; exports `generateNet` for browser use via `window.Shape2Flat`.
- Input comes from `--input` SVG content or `--path` data; outputs SVG with groups `GLUE`, `SHAPE`, `FOLDING_LINES`, `CUT_LINES`, `DESIGN`, `INFO`, `BG` plus meta `{faces, perimeter, area}`.
- Default depth is 50, units follow `--unit` (mm by default) and propagate to `svg width/height` and rendered geometry.

## Core Flow
- `generateNet` (`src/core.mjs`) picks linear extraction first (`extractLinearPolygon`), otherwise samples curves via `flattenPath`; retries with tighter tolerance if fewer than 3 points.
- `extractPathInfo` (`src/svg-io.mjs`) prefers `<path>`, handles `rect/circle/ellipse/polygon/polyline`, applies accumulated transforms with `svgpath`, and records primitive params for rendering.
- `computeSegmentLengthsFromPath` (`src/path-segments.mjs`) reads M/L/H/V/A/Z only; stores line angles, collapses all arc pieces into one segment for circles/ellipses to keep side stack single-piece.
- `makeNet` (`src/net.mjs`) rotates the polygon so the longest straight edge is vertical (uses segment angles when arcs are present), mirrors horizontally, and merges segments shorter than `minSegment` before building side rectangles.

## Geometry & Layout Rules
- Side rectangles are ordered from the longest edge onward; heights come from merged edge lengths, widths equal `depth`, and `type` transfers arc/line info for downstream rendering.
- Layout keeps zero gap between stack and bases; centering ignores tabs by computing bounds from SHAPE + side stack only.
- Mirror base aligns to the same edge span; for path inputs the original `d` is re-used with transforms so detail survives flattening.
- Circle/ellipse bases stay primitive and tangent-align to the strip; rectangles render as axis-aligned primitives using the aligned bbox.

## Rendering & Styling
- `renderNetSvg` (`src/render.mjs`) repositions base/strip/mirror, recenters within `{width:210,height:297}` page unless overridden, and emits gray base fill (`#e5e5e5`), white mirror/sides, black `stroke-width=0.6`.
- Glue tabs are 7 mm; vertical seams use saw-tooth triangles when the segment `type` is `arc`, otherwise 45° miters, and fold lines render in `FOLDING_LINES` as white dashed `stroke-dasharray="2,1"`.
- `INFO` group prints total side-strip length plus per-segment diagnostics (type, length, angle) when `edgeLengths` were available; keep messages concise to avoid layout overlap.
- `BG` is a full-page white rect; `CUT_LINES` and `DESIGN` are placeholders—leave them empty unless adding new features.

## CLI & Workflows
- Install with `npm install`; run via `npm start` or `node bin/shape-2-flat.js --help`. Package exposes a binary (`npx shape-2-flat`) once published.
- Required flags: either `--input` or `--path`; optional `--scale` multiplies coordinates before layout, `--tolerance` controls sampling step, `--min-segment` merges small edges, `--margin` sets pre-centering offset.
- CLI dynamically imports ESM core, so stay compatible with Node ≥16 and avoid top-level ESM-only Node APIs in CommonJS entry.
- Default output is `assets/net.svg`; CLI prints perimeter with `unit` suffix. No automated tests—use sample commands in README for regression checks.

## Dependencies & Environment
- Geometry sampling relies on `svg-path-properties`; DOM parsing uses `@xmldom/xmldom` + `xpath`; transforms are baked with `svgpath`; these are loaded lazily when running under Node.
- Browser fallback paths skip Node-only libraries; keep feature additions tolerant of missing optional deps and guard `window`/`document` access.
- `generateNet` attaches itself to `window.Shape2Flat` when a browser environment is detected—maintain this export for docs/demo compatibility.

## Editing Guidelines
- Preserve layout invariants (longest edge vertical, zero gap stack, tab geometry) and group semantics across modules.
- When changing geometry or styling, update `README.md` samples and mention new groups or defaults.
- Thread new CLI options consistently from `bin/shape-2-flat.js` through `generateNet`, `makeNet`, and `renderNetSvg`; keep names sync'd with yargs aliases.
- Respect ASCII encoding; add concise comments only for non-obvious geometry steps; keep behavior-preserving refactors minimal.
