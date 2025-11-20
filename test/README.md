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

#### 7. **Complex Paths** - 4 tests

- Rectangle paths (4 sides)
- Triangle paths (3 sides)
- Mixed absolute and relative commands
- Paths combining arcs and lines

#### 8. **Edge Cases** - 11 tests

- Empty paths
- Null input
- Whitespace-only paths
- Scientific notation in numbers
- Minimal whitespace parsing
- Comma separators
- Zero-length segments
- Unsupported commands (C, Q, S, T) returning null

#### 9. **Number Parsing** - 6 tests

- Negative numbers
- Decimal numbers
- Numbers without leading zero (e.g., `.5`)
- Explicit plus signs
- Exponential notation (e.g., `1e2`)
- Negative exponents (e.g., `1e-1`)

#### 10. **Angle Calculations** - 5 tests

- Horizontal lines (0° and 180°)
- Vertical lines (90° and -90°)
- Diagonal lines (45°)

### Total Coverage

**52 tests** covering:

- All supported SVG path commands: M, L, H, V, A, Z (absolute and relative)
- Length calculations for lines and arcs
- Angle calculations for line segments
- Edge cases and error conditions
- Number parsing variations

### Unsupported Commands

The function correctly returns `null` for unsupported commands:

- **C/c** - Cubic Bézier curve
- **Q/q** - Quadratic Bézier curve
- **S/s** - Smooth cubic Bézier
- **T/t** - Smooth quadratic Bézier

This signals the need to fall back to alternative path flattening methods.

### Test Framework

The test file includes a minimal test framework implementation with:

- `describe()` - Groups related tests
- `it()` - Individual test cases
- `assertClose()` - Helper for floating-point comparisons with tolerance
- Automatic test runner with summary reporting
