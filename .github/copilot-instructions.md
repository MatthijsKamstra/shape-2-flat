# Copilot Guide

## Purpose & Output

- Node CLI (`bin/shape-2-flat.js`) turns SVG paths or primitives into A4 printable prism nets; exports `generateNet` for browser use via `window.Shape2Flat`.
- Input comes from `--input` SVG content or `--path` data; outputs SVG with groups `GLUE_SIDE`, `GLUE_SHAPE`, `SHAPE`, `FOLDING_SIDE`, `FOLDING_SHAPE`, `CUT_LINES`, `DESIGN`, `INFO`, `DEBUG`, `BG` plus meta `{faces, perimeter, area}`.
- Default depth is 50, units follow `--unit` (mm by default) and propagate to `svg width/height` and rendered geometry.

## Core Flow

- `generateNet` (`src/core.mjs`) picks linear extraction first (`extractLinearPolygon`), otherwise samples curves via `flattenPath`; retries with tighter tolerance if fewer than 3 points.
- `extractPathInfo` (`src/svg-io.mjs`) prefers `<path>`, handles `rect/circle/ellipse/polygon/polyline`, applies accumulated transforms with `svgpath`, and records primitive params for rendering.
- `computeSegmentLengthsFromPath` (`src/path-segments.mjs`) supports all SVG path commands (M/L/H/V/A/C/Q/S/T/Z absolute/relative); stores line angles & endpoints, uses `svg-path-properties` for arc & Bézier lengths, records control points (including reflected S/T), quadratic flag, arcParams (rx, ry, xRot, largeArc, sweep). Circles/ellipses collapsed to single arc segment to keep side stack one-piece.
- `makeNet` (`src/net.mjs`) rotates the polygon so the longest straight edge is vertical (using segment angles if arcs), mirrors horizontally, merges segments shorter than `minSegment` before building side rectangles.

## Geometry & Layout Rules

- Side rectangles ordered from longest edge onward; heights from merged edge lengths, widths = depth; segment `type` (line/arc/curve) preserved.
- Zero gap between side strip and bases; centering ignores glue tabs (bounds from SHAPE + side stack only).
- Mirror base aligns to same edge span using original path data (not flattened) so detail survives.
- Circle/ellipse primitives tangent-align to the strip; rectangles remain axis-aligned. Arc/curve tab generation avoids polygon flattening.

## Rendering & Styling

- `renderNetSvg` (`src/render.mjs`) repositions base/strip/mirror, recenters within `{width:210,height:297}`, emits gray base fill (#e5e5e5), white mirror/sides, black stroke-width 0.6.
- Glue tab system:
  - Straight edges: bilateral 7 mm trapezoid tabs (45° miters)
  - Arc segments & circle/ellipse primitives: single star perimeter tab (spikes 12–48) using true arc/ellipse center
  - Bézier curves (C/Q/S/T): star perimeter tab via circle fit (circumcenter of start, midpoint sample t=0.5, end; midpoint fallback if collinear)
  - Curved vertical seams: saw-tooth triangular tabs; straight seams: trapezoids
  - Spike heuristic: `spikes = clamp(12,48, round(perimeter / 8))` (ellipse perimeter via Ramanujan; curves fitted circle; arcs segment length proportion)
  - Fold lines: white dashed `stroke-dasharray="2,1"`; star tabs fold at alternate inner vertices only
  - Tabs: white fill, black stroke; excluded from centering
- `INFO` group: perimeter + per-segment diagnostics (type/length/angle); hidden with `style="display:none"` when `--debug` false
- `BG`: full-page white rect; `CUT_LINES` & `DESIGN` placeholders; `DEBUG`: fitted circles (base red/orange, mirror blue/cyan) + center markers; hidden with `style="display:none"` when `--debug` false.

## CLI & Workflows

- Install with `npm install`; run via `npm start` or `node bin/shape-2-flat.js --help`. Package exposes a binary (`npx shape-2-flat`) once published.
- Required flags: either `--input` or `--path`; optional `--scale` multiplies coordinates before layout, `--tolerance` controls sampling step, `--min-segment` merges small edges, `--margin` sets pre-centering offset.
- `--debug` controls visibility of `DEBUG` and `INFO` groups (always generated; hidden via `style="display:none"` when false); default off.
- CLI dynamically imports ESM core, so stay compatible with Node ≥16 and avoid top-level ESM-only Node APIs in CommonJS entry.
- Default output is `assets/net.svg`; CLI prints perimeter with `unit` suffix. No automated tests—use sample commands in README for regression checks.

## Dependencies & Environment

- Geometry sampling relies on `svg-path-properties`; DOM parsing uses `@xmldom/xmldom` + `xpath`; transforms are baked with `svgpath`; these are loaded lazily when running under Node.
- Browser fallback paths skip Node-only libraries; keep feature additions tolerant of missing optional deps and guard `window`/`document` access.
- `generateNet` attaches itself to `window.Shape2Flat` when a browser environment is detected—maintain this export for docs/demo compatibility.

## Editing Guidelines

- Preserve layout invariants (longest edge vertical, zero gap stack, tab geometry) and group semantics.
- When changing geometry/styling (star tabs, spike heuristic), update README, TERMINOLOGY.md, and this guide.
- Thread new CLI options through `bin/shape-2-flat.js` → `generateNet` → `makeNet` → `renderNetSvg`.
- Respect ASCII; add concise comments only for non-obvious geometry; keep refactors minimal.

## Curve & Arc Centers

- Arc center: SVG spec (radii normalization, rotation, midpoint transform) used for star tab radii & DEBUG circle.
- Curve center: circumcenter of (start, midpoint sample t=0.5, end); fallback midpoint if near-collinear.
- Fitted radius drives spike count & debug outline.

## Segment Metadata

- Lines: endpoints (x1,y1,x2,y2), length, angle
- Arcs: arcParams (rx, ry, xRot, largeArc, sweep) + endpoints (center derived when needed)
- Curves: endpoints + control points (cx1,cy1[,cx2,cy2]) + quadratic flag; sampled midpoint for fitting
- Propagated via `makeNet` sideRects to `renderNetSvg` for tab decisions & diagnostics.

## Star Tab Heuristic Rationale

- ≈1 spike / 8 units perimeter balances flexibility vs cutting effort.
- Clamp prevents undersampling (min 12) and oversampling (max 48).
- Future option: `--spike-density` to override baseline.
