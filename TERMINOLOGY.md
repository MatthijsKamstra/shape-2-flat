# Terminology

- Base: The original input polygon (after flattening and simplification). Rotated so the longest edge is vertical.
- Mirror: A horizontal mirror of the Base, used as the opposite face of the extruded prism.
- Extrusion depth (depth parameter): The “depth” of the 3D shape; in the net this is the width of each side rectangle.
- Side rectangles: For rectangles, four rectangles stacked vertically between Base and Mirror. Each rect has:
  - width = extrusion depth (from --depth)
  - height = corresponding edge length
- Connected layout: Base (left), side-rect stack (center), Mirror (right) with the extrusion depth.
- Fill and stroke: All shapes white fill with black stroke.
- Page size: Output SVG is A4 (210×297) in the chosen unit (default mm).
- Min segment: Very small edges (shorter than `--min-segment`) are merged into the previous rectangle.
- Grouping: Output contains SHAPE (main model), GLUE (glue tabs), FOLDING (fold lines), DESIGN (overlay layer placeholder).
- Glue tabs: 7 mm tabs with 45° angled ends are added on all four sides of each side rectangle in the GLUE group only. Tabs have gray fill (#ccc) and no stroke. Fold lines are drawn as dashed paths in the FOLDING group. Centering and layout use SHAPE bounds.
