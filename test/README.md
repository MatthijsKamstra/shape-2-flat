# Test Suite for shape-2-flat

## Path Segments Tests

The `path-segments.test.mjs` file contains comprehensive tests for the `computeSegmentLengthsFromPath` function, which calculates the length of all parts/segments of SVG path commands.

### Running Tests

```bash
npm test
```

### Test Coverage

The test suite covers all supported SVG path commands and variations:

#### 1. **MoveTo (M/m)** - 3 tests

- Absolute and relative moveto commands
- Handling of implicit LineTo after first coordinate pair

#### 2. **LineTo (L/l)** - 5 tests

- Absolute and relative line commands
- Multiple LineTo commands in sequence
- Diagonal lines (Pythagorean theorem verification)
- Multiple coordinate pairs in a single L command

#### 3. **HorizontalLineTo (H/h)** - 4 tests

- Absolute and relative horizontal lines
- Negative movement (leftward)
- Multiple H values in sequence
- Angle calculations (0° right, 180° left)

#### 4. **VerticalLineTo (V/v)** - 4 tests

- Absolute and relative vertical lines
- Negative movement (upward)
- Multiple V values in sequence
- Angle calculations (90° down, -90° up)

#### 5. **Arc (A/a)** - 7 tests

- Absolute and relative arc commands
- Multiple arcs in sequence
- Elliptical arcs with different radii
- Arc rotation (x-axis-rotation parameter)
- Large arc flag variations
- Sweep flag variations

#### 6. **ClosePath (Z/z)** - 3 tests

- Closing path with automatic line segment
- Handling when already at starting point
- Case-insensitive z/Z commands

#### 7. **Cubic Bézier (C/c)** - 4 tests

- Absolute and relative cubic Bézier curves
- Multiple curves in sequence
- Multiple coordinate sets in single command
- Length calculation using svg-path-properties

#### 8. **Smooth Cubic Bézier (S/s)** - 4 tests

- Smooth curves after previous C command
- S command without previous curve
- Relative smooth cubic Bézier
- Control point reset after non-curve commands

#### 9. **Quadratic Bézier (Q/q)** - 4 tests

- Absolute and relative quadratic Bézier curves
- Multiple curves in sequence
- Multiple coordinate sets in single command

#### 10. **Smooth Quadratic Bézier (T/t)** - 4 tests

- Smooth curves after previous Q command
- T command without previous curve
- Relative smooth quadratic Bézier
- Chained T commands

#### 11. **Complex Paths** - 6 tests

- Rectangle paths (4 sides)
- Triangle paths (3 sides)
- Mixed absolute and relative commands
- Paths combining arcs and lines
- Paths with curves, arcs, and lines
- Paths with smooth curves after non-curve commands

#### 12. **Edge Cases** - 11 tests

- Empty paths
- Null input
- Whitespace-only paths
- Scientific notation in numbers
- Minimal whitespace parsing
- Comma separators
- Zero-length segments
- Bézier curve command support (C, Q, S, T)

#### 13. **Number Parsing** - 6 tests

- Negative numbers
- Decimal numbers
- Numbers without leading zero (e.g., `.5`)
- Explicit plus signs
- Exponential notation (e.g., `1e2`)
- Negative exponents (e.g., `1e-1`)

#### 14. **Angle Calculations** - 5 tests

- Horizontal lines (0° and 180°)
- Vertical lines (90° and -90°)
- Diagonal lines (45°)

### Total Coverage

**70 tests** covering:

- **All SVG path commands**: M, L, H, V, A, C, Q, S, T, Z (absolute and relative)
- Length calculations for lines, arcs, and Bézier curves
- Angle calculations for line segments
- Control point tracking for smooth curve commands
- Edge cases and error conditions
- Number parsing variations

### Curve Implementation

Bézier curves (C, Q, S, T) are fully supported using:

- `svg-path-properties` library for accurate curve length calculation in Node.js
- Browser fallback using native `SVGPathElement.getTotalLength()`
- Proper control point reflection for smooth curve commands (S/T)
- Control point reset when encountering non-curve commands

### Test Framework

The test file includes a minimal test framework implementation with:

- `describe()` - Groups related tests
- `it()` - Individual test cases
- `assertClose()` - Helper for floating-point comparisons with tolerance
- Automatic test runner with summary reporting

---

## Shape Glue Tabs Tests

The `shape-glue-tabs.test.mjs` file contains comprehensive tests for the shape glue tab functionality added to base and mirror shapes.

### Running Tests

```bash
npm run test:tabs
# or
node test/shape-glue-tabs.test.mjs
```

### Test Coverage

The test suite covers all aspects of the shape glue tabs feature:

#### 1. **Shape Glue Tabs - Rectangle** - 8 tests

- Glue tabs for all 4 sides of rectangle base (16 tabs total: 8 per shape)
- Glue tabs on both sides of each edge (bilateral tabs)
- Fold lines for all 4 sides (8 fold lines total)
- 7mm tab height for horizontal edges
- GLUE_SHAPE group creation
- FOLDING_SHAPE group creation
- Separate GLUE_SIDE for side rectangles
- Separate FOLDING_SIDE for side rectangles

#### 2. **Shape Glue Tabs - Hexagon** - 2 tests

- Glue tabs for all 6 sides of hexagon (20+ tabs)
- Proper handling of angled edges

#### 3. **Shape Glue Tabs - Triangle** - 1 test

- Glue tabs for all 3 sides of triangle (8+ tabs)

#### 4. **Shape Types Preservation** - 5 tests

- Rect elements preserved as `<rect>` when from SVG rect
- Circle elements preserved as `<circle>`
- Ellipse elements preserved as `<ellipse>`
- Path elements kept as `<path>`
- Polygon elements preserved with original path data

#### 5. **Circle/Ellipse - No Shape Glue Tabs** - 3 tests

- Circles don't generate GLUE_SHAPE tabs (primitives, not polygons)
- Ellipses don't generate GLUE_SHAPE tabs
- Circles still generate GLUE_SIDE tabs for side panels

#### 6. **Tab Dimensions** - 3 tests

- Tabs have correct trapezoid shape (4-vertex paths)
- Tabs have gray fill color (#e5e5e5)
- Fold lines have dashed white stroke

#### 7. **Group Structure** - 3 tests

- All required groups present (GLUE_SIDE, GLUE_SHAPE, SHAPE, FOLDING_SIDE, FOLDING_SHAPE, CUT_LINES, DESIGN, INFO, BG)
- Side tabs separated from shape tabs
- Side fold lines separated from shape fold lines

### Key Features Tested

**Glue Tab Implementation:**

- Full-length tabs along each edge
- Bilateral tabs (one on each side of fold line)
- 7mm tab width/height
- Trapezoid shape with tapered ends
- Gray fill (#e5e5e5) without stroke

**Fold Line Implementation:**

- White dashed lines along edges
- Separate groups for sides vs. shapes
- `stroke-dasharray` for dashed appearance

**Group Separation:**

- `GLUE_SIDE`: Tabs for side panel rectangles
- `GLUE_SHAPE`: Tabs for base and mirror shape edges
- `FOLDING_SIDE`: Fold lines for side panel edges
- `FOLDING_SHAPE`: Fold lines for base and mirror shape edges

**Shape Type Preservation:**

- Rect elements stay as `<rect>` (not converted to path)
- Circle/ellipse stay as primitives
- Path elements preserved with transforms
- Polygon/polyline converted to path but data preserved

### Total Coverage

**25 tests** covering:

- Rectangular, hexagonal, and triangular shapes
- Tab generation for all polygon edges
- Bilateral tab placement
- Tab dimensions and styling
- Shape type preservation
- Group structure and separation
- Circle/ellipse special handling
- Integration with existing side panel tabs

### Test Framework

Uses the same minimal test framework as path-segments tests:

- `describe()` - Groups related tests
- `it()` - Individual test cases
- `countMatches()` - Helper to count regex matches in SVG
- `extractGroup()` - Helper to extract SVG group content

---

## Running All Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:segments
npm run test:tabs

# Run with shell script
bash test/run-tests.sh
```

```

```
