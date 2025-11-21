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
  - `SHAPE`: Main geometry (base, mirror, side rectangles) — base light gray `#e5e5e5`, sides & mirror white
  - `GLUE_SIDE`: Glue tabs for side strip seams (trapezoids for straight seams, saw-tooth triangles for curved seams)
  - `GLUE_SHAPE`: Glue tabs along base/mirror perimeter (excluding attachment edge); includes trapezoids (straight) and star tabs (arc/curve)
  - `FOLDING_SIDE`: Dashed fold lines for side panels (`stroke-dasharray="2,1"`, white stroke)
  - `FOLDING_SHAPE`: Fold lines for base/mirror tabs (alternate inner vertices for star tabs)
  - `CUT_LINES`: Reserved placeholder
  - `DESIGN`: User artwork placeholder
  - `INFO`: Diagnostics: total perimeter, per-segment length/angle/type
  - `DEBUG`: Fitted circles/ellipses for arc & curve segments (base red/orange, mirror blue/cyan) + center markers
  - `COLOFON`: Color swatches for the palette used in the output (stroke matches fill, stroke-width 0.6)
  - `BG`: Page background (white rect)

## Styles

- **Base**: light gray `#e5e5e5`, stroke black `stroke-width=0.6`
- **Mirror & sides**: white fill, same stroke
- **Glue tabs (straight)**: bilateral 7 mm trapezoids (white fill, black stroke)
- **Glue tabs (arc/curve)**: star tab (single closed path) built from fitted center; spikes 12–48 (see heuristic); white fill, black stroke
- **Vertical seams (curved)**: saw-tooth triangular tabs for flexibility
- **Fold lines**: white dashed `stroke-dasharray="2,1"`
- **Primitives**: rect/circle/ellipse preserved (not path-converted)

## Path Command Support & Segment Data

All SVG path commands are fully supported:

- **M/m** - MoveTo (absolute/relative)
- **L/l** - LineTo (absolute/relative)
- **H/h** - Horizontal LineTo (absolute/relative)
- **V/v** - Vertical LineTo (absolute/relative)
  -- **A/a** - Arc (absolute/relative) - arcParams stored (rx, ry, xRot, largeArc, sweep) + endpoints; accurate center computed
  -- **C/c** - Cubic Bézier curve (absolute/relative) - endpoints + (cx1,cy1,cx2,cy2)
  -- **Q/q** - Quadratic Bézier curve (absolute/relative) - endpoints + (cx1,cy1), flagged quadratic
  -- **S/s** - Smooth cubic Bézier (absolute/relative) - reflected first control point + explicit second; control points stored
  -- **T/t** - Smooth quadratic Bézier (absolute/relative) - reflected control point stored with quadratic flag
- **Z/z** - ClosePath (case-insensitive)

## Pipeline

1. **Input** (`src/svg-io.mjs`): Parse SVG → extract path data (supports `path`/`rect`/`circle`/`ellipse`/`polygon`/`polyline`)
2. **Flatten** (`src/path-flatten.mjs`): Convert curves to polygon points with `--tolerance` (fallback for complex paths)
3. **Simplify** (`src/path-flatten.mjs`): Remove colinear points while preserving shape
4. **Compute** (`src/path-segments.mjs`): Calculate segment lengths for all path commands using `svg-path-properties` (arcs and Bézier curves) or direct calculation (lines)
5. **Generate** (`src/net.mjs`): Create net layout (base, mirror, side rects) with rotation and alignment, preserving segment types (`line`/`arc`/`curve`)
6. **Render** (`src/render.mjs`): Output grouped SVG with trapezoid, saw-tooth, and star tabs; fold lines; INFO diagnostics; DEBUG visual centers

## Glue Tab Types

- **Trapezoid Tab**: Straight edge bilateral tab; full edge length with tapered ends (45°)
- **Saw-tooth Seam Tabs**: Triangular teeth on vertical seams when adjoining segment `type` is arc or curve; improves bending
- **Star Tab**: Single perimeter path for arcs/curves (including circle/ellipse primitives) — outward spikes alternate with inward vertices; fold lines placed on every other inward vertex

## Star Tab Spike Heuristic

`spikes = clamp(12,48, round(perimeter / 8))`

- Perimeter for ellipse via Ramanujan approximation; arcs use segment length proportion; curves use fitted circle circumference
- Ensures ≈1 spike per 8 units while clamping to avoid undersampling (<12) or oversampling (>48)

## Fitted Centers

- **Arc Center**: Calculated per SVG spec (radii normalization, rotation, midpoint transform)
- **Curve Center**: Circumcenter of start, midpoint sample (t=0.5), end; midpoint fallback if collinear

## Endpoint & Control Propagation

- All segments carry endpoints (x1,y1,x2,y2)
- Curves carry control points; arcs carry arcParams; used for tab geometry & diagnostics
