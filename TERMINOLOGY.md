# Terminology

## Core Concepts

- **Base**: The original input polygon (after flattening and simplification). Rotated so the longest edge is vertical.
- **Mirror**: A horizontal mirror of the Base, used as the opposite face of the extruded prism.
- **Extrusion depth**: The "depth" of the 3D shape (from `--depth` parameter); in the net this is the width of each side rectangle.
- **Side rectangles**: Variable number of rectangles stacked vertically between Base and Mirror. Each rectangle has:
  - `width` = extrusion depth (from `--depth`)
  - `height` = corresponding edge length (from polygon perimeter)
  - Edges shorter than `--min-segment` are merged into the previous rectangle

## Layout

- **Connected layout**: Base (left), side-rectangle stack (center), Mirror (right) — no gaps between parts (`gap = 0`)
- **Alignment**: Base and Mirror are tangent-aligned to the side stack:
  - Base: longest edge vertical on left side
  - Mirror: horizontal mirror on right side, aligned on same edge span
  - Circle/Ellipse: tangent-aligned (base rightmost, mirror leftmost)
- **Centering**: Uses bounds of `SHAPE` and side stack only; `GLUE`/`FOLDING_LINES` do not influence layout

## Output Structure

- **Page size**: A4 (210×297) in chosen unit (default `mm`)
- **SVG Groups**:
  - `SHAPE`: Main model geometry (base, mirror, side rectangles)
  - `GLUE_SIDE`: Glue tabs for side panels (7mm, 45° angled ends, gray fill `#e5e5e5`, no stroke)
  - `GLUE_SHAPE`: Glue tabs for base/mirror shapes (currently empty, reserved for future use)
  - `FOLDING_SIDE`: Dashed fold lines for side panels (white `#FFF`, `stroke-dasharray="2,1"`)
  - `FOLDING_SHAPE`: Fold lines for base/mirror shapes (currently empty, reserved for future use)
  - `CUT_LINES`: Reserved (currently empty)
  - `DESIGN`: Overlay layer (reserved for custom designs)
  - `INFO`: Perimeter text label
  - `BG`: White page background

## Styles

- **SHAPE fill/stroke**:
  - Base: gray fill `#e5e5e5`, black stroke `stroke-width=0.6`
  - Mirror & sides: white fill, black stroke `stroke-width=0.6`
- **Glue tabs**: 7mm with 45° angled ends on all four sides; for shapes with curves (circles/ellipses/Bézier curves), vertical seams use saw-tooth triangular tabs for easier bending
- **Primitives**: rect/circle/ellipse inputs preserved as native SVG elements (not converted to paths)

## Path Command Support

All SVG path commands are fully supported:

- **M/m** - MoveTo (absolute/relative)
- **L/l** - LineTo (absolute/relative)
- **H/h** - Horizontal LineTo (absolute/relative)
- **V/v** - Vertical LineTo (absolute/relative)
- **A/a** - Arc (absolute/relative) - uses `svg-path-properties` for accurate length
- **C/c** - Cubic Bézier curve (absolute/relative)
- **Q/q** - Quadratic Bézier curve (absolute/relative)
- **S/s** - Smooth cubic Bézier (absolute/relative) - with control point reflection
- **T/t** - Smooth quadratic Bézier (absolute/relative) - with control point reflection
- **Z/z** - ClosePath (case-insensitive)

## Pipeline

1. **Input** (`src/svg-io.mjs`): Parse SVG → extract path data (supports `path`/`rect`/`circle`/`ellipse`/`polygon`/`polyline`)
2. **Flatten** (`src/path-flatten.mjs`): Convert curves to polygon points with `--tolerance` (fallback for complex paths)
3. **Simplify** (`src/path-flatten.mjs`): Remove colinear points while preserving shape
4. **Compute** (`src/path-segments.mjs`): Calculate segment lengths for all path commands using `svg-path-properties` (arcs and Bézier curves) or direct calculation (lines)
5. **Generate** (`src/net.mjs`): Create net layout (base, mirror, side rects) with rotation and alignment, preserving segment types (`line`/`arc`/`curve`)
6. **Render** (`src/render.mjs`): Output grouped SVG with tabs (saw-tooth for curved segments) and fold lines
