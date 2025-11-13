# shape-2-flat

Convert an SVG path into a printable A4 SVG net (unfolded layout) of an extruded prism. White fill with black stroke (no glue tabs yet).

## What it does

- Reads an SVG path (or rect/polygon) and flattens it to a polygon
- Creates a prism of height H by:
  - Base (original polygon), rotated so the longest edge is vertical
  - Mirrored Base (horizontal mirror) placed to the right
  - Side rectangles (voor rechthoeken: precies vier), verticaal gestapeld tussen Base en Mirror met:
    - height = bijbehorende randlengte in volgorde lang, kort, lang, kort
    - width = extrusion depth (die je via --depth opgeeft)
- Outputs an A4-sized SVG (210×297mm) with white-filled shapes and black stroke outlines

## Quick start

- Input: either provide an SVG file containing a path, or a `d` path string directly.

Examples:

```sh
# Using a path string (rectangle 100x50), height 30mm, output to assets/net.svg
npx shape-2-flat --path "M0,0 L100,0 L100,50 L0,50 Z" --height 30 --unit mm --output assets/net.svg

# Using an SVG file as input
npx shape-2-flat --input assets/rounded.svg --depth 40 --tolerance 0.5 --output assets/net.svg
```

If you cloned this repo locally:

```sh
npm install
node bin/shape-2-flat.js --path "M0,0 L120,0 L120,60 L0,60 Z" --height 40 --output assets/net.svg
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
- --unit, -u: Output dimension unit (px, mm) default px

## Notes and limitations

- Arcs (A) are handled via sampling; tolerance controls detail
- Self-intersecting paths are not supported
- For rectangles: side rectangles are four segments ordered long, short, long, short; connected without gaps; no glue tabs
- Units are not converted; you control them via the `--unit` flag and the `--scale` option
  - A4 canvas is fixed to 210×297 in the chosen `--unit` (use `--unit mm` for print)

## Docs

- See `docs/TERMINOLOGY.md` for terminology
- See `docs/COPILOT.md` for a quick collaboration guide

## License

MIT
