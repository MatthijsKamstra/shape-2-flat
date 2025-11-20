# Test SVG Files

This folder contains test SVG files that demonstrate all the glue tab features discussed in the development conversation.

## Feature Test Files

### Basic Shapes

- **test_rectangle.svg** - Simple rectangle to verify bilateral trapezoid tabs on straight edges
- **test_circle.svg** - Circle to verify full 360° star-pattern tabs
- **test_ellipse.svg** - Ellipse with different radii to verify star-pattern scaling

### Polygon Shapes

- **test_hexagon.svg** - Hexagon to verify angled edge tab alignment
- **test_triangle.svg** - Triangle to verify tabs work on all angled sides
- **test_polyline.svg** - Polyline to verify shape type preservation

### Curved Edge Shapes

- **test_rounded_rect.svg** - Rounded rectangle (rect with rx/ry) to verify arc edge star-pattern tabs
- **test_curved_path.svg** - Path with Bézier curves (Q/T commands) to verify curve edge star-pattern tabs
- **test_mixed_path.svg** - Path with both straight lines and curves to verify mixed tab handling

### Edge Cases

- **test_small_circle.svg** - Small circle to verify minimum spike count (12 spikes)

## Expected Behaviors

### Straight Edges (line type)
- Generate **bilateral trapezoid tabs** (2 per edge)
- Tab width: 7mm perpendicular to edge
- Taper inward from endpoints
- Single fold line along the edge

### Circles/Ellipses (primitives)
- Generate **full 360° star-pattern** around perimeter
- Number of spikes: 12-48 based on perimeter (~1 per 8mm)
- Inner radius: original radius (rx, ry)
- Outer radius: radius + 7mm
- Fold lines between consecutive inner points

### Arc/Curve Edges (arc/curve type)
- Generate **star-pattern along edge** (not full 360°)
- Number of spikes: 4-16 based on edge length (~1 per 8mm)
- Pattern follows linear interpolation between edge endpoints
- Alternates inner (on edge) and outer (7mm perpendicular) points
- Fold lines connect consecutive inner points

## Test Coverage

These files cover all the features discussed:
1. ✅ Straight edge bilateral trapezoid tabs
2. ✅ Tabs on both sides of edges
3. ✅ Proper alignment with angled edges (normal vector calculation)
4. ✅ Circle/ellipse star-pattern tabs (size-dependent spike count)
5. ✅ Arc edge star-pattern tabs
6. ✅ Curve (Bézier) edge star-pattern tabs
7. ✅ Shape type preservation (rect, circle, ellipse, path, polygon, polyline)
8. ✅ Tab dimensions (7mm height/width)
9. ✅ Fold line generation

## Usage

Run `sh convert.sh` to generate all test outputs in the `export/` folder.

Individual tests:
```bash
node bin/shape-2-flat.js -i originals/test_circle.svg -o export/e_test_circle.svg
node bin/shape-2-flat.js -i originals/test_hexagon.svg -o export/e_test_hexagon.svg
node bin/shape-2-flat.js -i originals/test_rounded_rect.svg -o export/e_test_rounded_rect.svg
```
