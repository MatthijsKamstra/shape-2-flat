# shape-2-flat

Convert an SVG path into a printable A4 SVG net (unfolded layout) of an extruded prism. White fill with black stroke. Output is grouped into SHAPE, GLUE, FOLDING_LINES, and DESIGN; tabs live in GLUE and fold lines in FOLDING_LINES.

## What it does

- Reads an SVG path (or rect/polygon/circle/ellipse) and flattens it to a polygon
- Creates a prism of depth D by:
  - Base (original polygon), rotated so the longest edge is vertical
  - Mirrored Base (horizontal mirror) placed to the right
  - Side rectangles (voor rechthoeken: precies vier), verticaal gestapeld tussen Base en Mirror met:
    - height = bijbehorende randlengte in volgorde lang, kort, lang, kort
    - width = extrusion depth (die je via --depth opgeeft)
- Outputs an A4-sized SVG (210×297mm) with white-filled shapes and black stroke outlines
- Groups: <g id="SHAPE"> for base/mirror/sides, <g id="GLUE"> for glue tabs, <g id="FOLDING_LINES"> for dashed fold lines, <g id="DESIGN"> reserved for overlays
- Glue tabs: 7 mm tabs with 45° angled ends (papertoy style), gray fill (#ccc) without stroke. For circle/ellipse, vertical seams use saw‑tooth (triangular) tabs for easier bending; top/bottom remain 45°. Tabs render into GLUE and do not affect SHAPE centering. Fold lines are drawn into FOLDING_LINES.
- Primitives: circle/ellipse/rect inputs render as their original primitives in SHAPE (not converted to paths). Circle/ellipse are tangent‑aligned to the side stack (base: rightmost point, mirror: leftmost point).
- Perimeter overlay: a small "Perimeter: N unit" label is added in DESIGN for quick validation (equals the total side‑strip length/circumference).

## Quick start

- Input: either provide an SVG file containing a path, or a `d` path string directly.

Examples:

```sh
# Using a path string (rectangle 100x50), depth 30mm, output to assets/net.svg
npx shape-2-flat --path "M0,0 L100,0 L100,50 L0,50 Z" --depth 30 --unit mm --output assets/net.svg

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

## Notes and limitations

- **All SVG path commands are supported**: M, L, H, V, A, C, Q, S, T, Z (both absolute and relative)
- Bézier curves (C, Q, S, T) and arcs (A) use `svg-path-properties` for accurate length calculation
- Self-intersecting paths are not supported
- For rectangles: side rectangles are four segments ordered long, short, long, short; connected without gaps
- Arc handling: arc segments contribute exact arc length to side‑rect heights. For pure circle/ellipse inputs, the side stack uses one rectangle whose height equals the circumference.
- Glue tabs: 7 mm angled tabs (gray fill, no stroke) are emitted in GLUE; for circle/ellipse the vertical seams use saw‑tooth tabs. SHAPE layout/centering excludes tabs. Fold lines appear in FOLDING_LINES.
- Units are not converted; you control them via the `--unit` flag and the `--scale` option. Default unit is mm.
  - A4 canvas is fixed to 210×297 in the chosen `--unit` (use `--unit mm` for print)

## Docs

- See `TERMINOLOGY.md` for terminology
- See `.github/copilot-instructions.md` for a copilot prompt reference

## License

MIT
