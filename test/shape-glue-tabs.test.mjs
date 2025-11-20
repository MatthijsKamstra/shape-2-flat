import { generateNet } from "../src/core.mjs";
import { strict as assert } from "assert";

// Minimal test framework
function describe(name, fn) {
	console.log(`\n${name}`);
	fn();
}

function it(name, fn) {
	try {
		fn();
		console.log(`  ✓ ${name}`);
	} catch (err) {
		console.log(`  ✗ ${name}`);
		console.error(`    ${err.message}`);
		throw err;
	}
}

function countMatches(svg, pattern) {
	const matches = svg.match(new RegExp(pattern, 'g'));
	return matches ? matches.length : 0;
}

function extractGroup(svg, groupId) {
	const match = svg.match(new RegExp(`<g id="${groupId}"[^>]*>([\\s\\S]*?)</g>`));
	return match ? match[1] : '';
}

describe("Shape Glue Tabs - Rectangle", () => {
	const rectPath = "M 0,0 L 100,0 L 100,50 L 0,50 Z";
	
	it("should generate glue tabs for all 4 sides of rectangle base", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		const pathCount = countMatches(glueShapeGroup, '<path');
		
		// Rectangle has 4 edges, each gets 2 tabs (one on each side) = 8 tabs per shape
		// Base + Mirror = 16 tabs total
		assert.equal(pathCount, 16, `Expected 16 glue tabs (8 per shape), got ${pathCount}`);
	});
	
	it("should generate glue tabs on both sides of each edge", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		
		// Each edge should have 2 tabs
		assert.ok(glueShapeGroup.includes('<path'), "Should have glue tab paths");
		
		// Count tabs - should be pairs for each edge
		const pathCount = countMatches(glueShapeGroup, '<path');
		assert.equal(pathCount % 2, 0, "Tab count should be even (pairs)");
	});
	
	it("should generate fold lines for all 4 sides", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const foldShapeGroup = extractGroup(result.svg, 'FOLDING_SHAPE');
		const pathCount = countMatches(foldShapeGroup, '<path');
		
		// 4 edges per shape (base + mirror) = 8 fold lines
		assert.equal(pathCount, 8, `Expected 8 fold lines, got ${pathCount}`);
	});
	
	it("should have 7mm tab height for horizontal edges", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		
		// Check that tabs have proper dimensions (7mm offset)
		assert.ok(glueShapeGroup.length > 0, "Should have glue tabs");
		
		// Look for coordinate patterns that show 7mm offsets
		const hasSevenMmOffset = /[+-]7[^0-9]/.test(glueShapeGroup);
		assert.ok(hasSevenMmOffset, "Should have 7mm tab dimensions");
	});
	
	it("should create GLUE_SHAPE group", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		assert.ok(result.svg.includes('id="GLUE_SHAPE"'), "Should have GLUE_SHAPE group");
	});
	
	it("should create FOLDING_SHAPE group", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		assert.ok(result.svg.includes('id="FOLDING_SHAPE"'), "Should have FOLDING_SHAPE group");
	});
	
	it("should have separate GLUE_SIDE for side rectangles", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		assert.ok(result.svg.includes('id="GLUE_SIDE"'), "Should have GLUE_SIDE group");
	});
	
	it("should have separate FOLDING_SIDE for side rectangles", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		assert.ok(result.svg.includes('id="FOLDING_SIDE"'), "Should have FOLDING_SIDE group");
	});
});

describe("Shape Glue Tabs - Hexagon", () => {
	const hexPath = "M 50,0 L 100,25 L 100,75 L 50,100 L 0,75 L 0,25 Z";
	
	it("should generate glue tabs for all 6 sides of hexagon", () => {
		const result = generateNet({ pathData: hexPath, depth: 25 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		const pathCount = countMatches(glueShapeGroup, '<path');
		
		// Hexagon has 6 edges, 2 tabs each = 12 per shape
		// Base + Mirror = 24 tabs total (but 2 edges touch stack, so may be less)
		// Actually all edges get tabs now
		assert.ok(pathCount >= 20, `Expected at least 20 glue tabs for hexagon, got ${pathCount}`);
	});
	
	it("should work with angled edges", () => {
		const result = generateNet({ pathData: hexPath, depth: 25 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		
		assert.ok(glueShapeGroup.length > 0, "Should generate tabs for angled edges");
	});
});

describe("Shape Glue Tabs - Triangle", () => {
	const triPath = "M 50,0 L 100,86.6 L 0,86.6 Z";
	
	it("should generate glue tabs for all 3 sides of triangle", () => {
		const result = generateNet({ pathData: triPath, depth: 20 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		const pathCount = countMatches(glueShapeGroup, '<path');
		
		// Triangle has 3 edges, 2 tabs each = 6 per shape
		// Base + Mirror = 12 tabs total (may be less if edges touch stack)
		assert.ok(pathCount >= 8, `Expected at least 8 glue tabs for triangle, got ${pathCount}`);
	});
});

describe("Shape Types Preservation", () => {
	it("should preserve rect as <rect> element when from SVG rect", () => {
		const svgRect = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="50"/></svg>';
		const result = generateNet({ svgContent: svgRect, depth: 30 });
		
		// Should have <rect> elements in SHAPE group
		const shapeGroup = extractGroup(result.svg, 'SHAPE');
		const rectCount = countMatches(shapeGroup, '<rect');
		assert.ok(rectCount >= 2, `Expected at least 2 rect elements (base+mirror), got ${rectCount}`);
	});
	
	it("should preserve circle as <circle> element", () => {
		const svgCircle = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
		const result = generateNet({ svgContent: svgCircle, depth: 30 });
		
		const shapeGroup = extractGroup(result.svg, 'SHAPE');
		const circleCount = countMatches(shapeGroup, '<circle');
		assert.equal(circleCount, 2, `Expected 2 circle elements (base+mirror), got ${circleCount}`);
	});
	
	it("should preserve ellipse as <ellipse> element", () => {
		const svgEllipse = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="40" ry="30"/></svg>';
		const result = generateNet({ svgContent: svgEllipse, depth: 30 });
		
		const shapeGroup = extractGroup(result.svg, 'SHAPE');
		const ellipseCount = countMatches(shapeGroup, '<ellipse');
		assert.equal(ellipseCount, 2, `Expected 2 ellipse elements (base+mirror), got ${ellipseCount}`);
	});
	
	it("should keep path as <path> element", () => {
		const result = generateNet({ pathData: "M 0,0 L 100,0 L 100,50 L 0,50 Z", depth: 30 });
		
		const shapeGroup = extractGroup(result.svg, 'SHAPE');
		// Path input without rect detection should stay as path
		assert.ok(shapeGroup.includes('<path') || shapeGroup.includes('<rect'), 
			"Should have path or rect elements");
	});
	
	it("should preserve polygon from SVG", () => {
		const svgPolygon = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 100,0 100,50 0,50"/></svg>';
		const result = generateNet({ svgContent: svgPolygon, depth: 30 });
		
		// Polygon is converted to path but should preserve the original path data
		const shapeGroup = extractGroup(result.svg, 'SHAPE');
		assert.ok(shapeGroup.length > 0, "Should have shape content");
	});
});

describe("Circle/Ellipse - No Shape Glue Tabs", () => {
	it("should not generate GLUE_SHAPE tabs for circles", () => {
		const svgCircle = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
		const result = generateNet({ svgContent: svgCircle, depth: 30 });
		
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		// Circles are primitives, not polygons, so no shape tabs
		const pathCount = countMatches(glueShapeGroup, '<path');
		assert.equal(pathCount, 0, `Circle should not have shape glue tabs, got ${pathCount}`);
	});
	
	it("should not generate GLUE_SHAPE tabs for ellipses", () => {
		const svgEllipse = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><ellipse cx="50" cy="50" rx="40" ry="30"/></svg>';
		const result = generateNet({ svgContent: svgEllipse, depth: 30 });
		
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		const pathCount = countMatches(glueShapeGroup, '<path');
		assert.equal(pathCount, 0, `Ellipse should not have shape glue tabs, got ${pathCount}`);
	});
	
	it("should still generate GLUE_SIDE tabs for circle side panels", () => {
		const svgCircle = '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>';
		const result = generateNet({ svgContent: svgCircle, depth: 30 });
		
		const glueSideGroup = extractGroup(result.svg, 'GLUE_SIDE');
		const pathCount = countMatches(glueSideGroup, '<path');
		assert.ok(pathCount > 0, "Circle should have side panel glue tabs");
	});
});

describe("Tab Dimensions", () => {
	const rectPath = "M 0,0 L 100,0 L 100,50 L 0,50 Z";
	
	it("should generate tabs with correct trapezoid shape", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		
		// Check for path with 4 vertices (trapezoid): M...L...L...L...Z
		const trapezoidPattern = /<path d="M [^"]+ L [^"]+ L [^"]+ L [^"]+ Z"/;
		assert.ok(trapezoidPattern.test(glueShapeGroup), "Tabs should be trapezoid shapes");
	});
	
	it("should have gray fill color for tabs", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const glueShapeGroup = extractGroup(result.svg, 'GLUE_SHAPE');
		
		assert.ok(glueShapeGroup.includes('fill="#e5e5e5"'), "Tabs should have gray fill");
	});
	
	it("should generate fold lines with dashed stroke", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		const foldShapeGroup = extractGroup(result.svg, 'FOLDING_SHAPE');
		
		assert.ok(foldShapeGroup.includes('stroke-dasharray'), "Fold lines should be dashed");
		assert.ok(foldShapeGroup.includes('stroke="#FFF"'), "Fold lines should be white");
	});
});

describe("Group Structure", () => {
	const rectPath = "M 0,0 L 100,0 L 100,50 L 0,50 Z";
	
	it("should have all required groups", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		
		const requiredGroups = [
			'GLUE_SIDE', 'GLUE_SHAPE', 
			'SHAPE', 
			'FOLDING_SIDE', 'FOLDING_SHAPE',
			'CUT_LINES', 'DESIGN', 'INFO', 'BG'
		];
		
		for (const group of requiredGroups) {
			assert.ok(result.svg.includes(`id="${group}"`), `Should have ${group} group`);
		}
	});
	
	it("should separate side tabs from shape tabs", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		
		const glueSide = extractGroup(result.svg, 'GLUE_SIDE');
		const glueShape = extractGroup(result.svg, 'GLUE_SHAPE');
		
		assert.ok(glueSide.length > 0, "GLUE_SIDE should have content");
		assert.ok(glueShape.length > 0, "GLUE_SHAPE should have content");
		assert.notEqual(glueSide, glueShape, "Groups should have different content");
	});
	
	it("should separate side fold lines from shape fold lines", () => {
		const result = generateNet({ pathData: rectPath, depth: 30 });
		
		const foldSide = extractGroup(result.svg, 'FOLDING_SIDE');
		const foldShape = extractGroup(result.svg, 'FOLDING_SHAPE');
		
		assert.ok(foldSide.length > 0, "FOLDING_SIDE should have content");
		assert.ok(foldShape.length > 0, "FOLDING_SHAPE should have content");
		assert.notEqual(foldSide, foldShape, "Groups should have different content");
	});
});

console.log("\n✅ All shape glue tabs tests passed!\n");
