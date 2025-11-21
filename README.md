# shape-2-flat

Convert an SVG path or primitive into a printable A4 SVG net (unfolded layout) of an extruded prism. Base/mirror use light gray fill (#e5e5e5); sides & tabs are white; stroke width is 0.6 (black). Output groups now include SHAPE, GLUE_SIDE, GLUE_SHAPE, FOLDING_SIDE, FOLDING_SHAPE, DESIGN, INFO, DEBUG, CUT_LINES (placeholder), BG, and COLOFON.

## What it does

- Reads an SVG path or primitive (rect / polygon / polyline / circle / ellipse); primitives are preserved (no forced path conversion) for fidelity.
- Rotates base so longest straight edge is vertical; mirrors original (not flattened) geometry to create the opposite face.
- Builds side strip from ordered segments (merging < min-segment) with zero gap between strip and bases.
- Centers layout ignoring glue tabs within an A4 page (210×297 in chosen unit).
- Exports groups:
  - SHAPE: base, mirror, side panels
  - GLUE_SIDE / FOLDING_SIDE: side strip tabs & fold lines
  - GLUE_SHAPE / FOLDING_SHAPE: base & mirror edge tabs (excluding attachment edge)
  - INFO: perimeter + edge diagnostics (type, length, angle)
  - DEBUG: fitted circles/ellipses for arc & curve segments
  - COLOFON: swatches of the color palette used in the export
  - DESIGN: user overlays (placeholder)
  - CUT_LINES: future die line output (placeholder)
  - BG: full-page white rectangle
- Glue tabs system:
  - Straight edges: bilateral 7 mm trapezoid tabs (two full-length trapezoids per edge)
  - Arc segments & circle/ellipse primitives: single star perimeter tab (12–48 spikes) using true arc/ellipse center
  - Bézier curves (C/Q/S/T): star tabs via circle fit (circumcenter of start / midpoint sample / end)
  - Curved vertical seams use saw-tooth triangles; straight seams use 45° miters.
- Spike count heuristic: `spikes = clamp(12,48, round(perimeter / 8))` (ellipse perimeter via Ramanujan; curves fitted circle; arcs segment length proportion)

## Quick start

- Input: either provide an SVG file containing a path, or a `d` path string directly.

Examples:

```sh
# Using a path string (rectangle 100x50), depth 30mm, output to assets/net.svg
npx shape-2-flat --path "M0,0 L100,0 L100,50 L0,50 Z" --depth 30 --unit mm --debug --output assets/net.svg

# Using an SVG file as input
npx shape-2-flat --input assets/rounded.svg --depth 40 --tolerance 0.5 --output assets/net.svg
```

If you cloned this repo locally:

```sh
npm install
node bin/shape-2-flat.js --path "M0,0 L120,0 L120,60 L0,60 Z" --depth 40 --output assets/net.svg
```

## Options

- --input, -i: SVG file path
- --path, -p: SVG path data string
- --depth, -d: Extrusion depth (default 50)
- --scale, -s: Scale factor for input points (default 1)
- --tolerance, -t: Curve flattening tolerance (smaller = more segments)
- --min-segment, -ms: Merge edge segments shorter than this into the previous (default 0.5)
- --margin, -m: Page margin in output (default 10) [some layouts use 0 to connect parts]
- --output, -o: Output SVG path (default assets/net.svg)
- --unit, -u: Output dimension unit (px, mm) default mm
- --debug: Show DEBUG and INFO groups (default false). Groups are always generated but hidden with `style="display:none"` when false

## Notes and limitations

- **All SVG path commands are supported**: M, L, H, V, A, C, Q, S, T, Z (both absolute and relative)
- Bézier curves (C, Q, S, T) and arcs (A) use `svg-path-properties` for accurate length calculation
- Self-intersecting paths are not supported
- For rectangles: side rectangles are four segments ordered long, short, long, short; connected without gaps
- Arc handling: arc segments contribute exact arc length to side‑rect heights. For pure circle/ellipse inputs, the side stack uses one rectangle whose height equals the circumference.
- Segment data includes endpoints (x1,y1,x2,y2), arc parameters (rx,ry,xRot,largeArc,sweep), and curve control points (cx1,cy1[,cx2,cy2], quadratic flag) for accurate lengths & tab geometry.
- Glue tabs: white fill, black stroke (same stroke width) in GLUE*\* groups; fold lines are dashed white (2,1) inside FOLDING*\* groups; tabs excluded from centering.
- Units are not converted; you control them via the `--unit` flag and the `--scale` option. Default unit is mm.
  - A4 canvas is fixed to 210×297 in the chosen `--unit` (use `--unit mm` for print)

## Docs

- See `TERMINOLOGY.md` for terminology
- See `.github/copilot-instructions.md` for a copilot prompt reference

## Curve & Arc Details

- Arc centers follow SVG spec (radii normalization, rotation, center transform) before star tab generation.
- Curve center circle fit: circumcenter of start, sampled midpoint (t=0.5), end; near-collinear fallback uses midpoint.
- Ellipse perimeter uses Ramanujan approximation; circle uses 2πr.
- Star tab path is a single closed polygon; fold lines only at every alternate inner vertex.
- DEBUG group renders fitted shapes (base: red/orange, mirror: blue/cyan) for visual verification.

## Performance Notes

- Star tab generation scales with spike count; very large perimeters may benefit from future `--spike-density` option.
- Flattening avoided for arc/curve tabs to prevent explosion of tiny trapezoids.

## Future Extensions

- CUT_LINES: die/perforation exports
- DESIGN: artwork overlay integration
- Potential options: custom spike density, alternate tab styles

## License

MIT
