#!/usr/bin/env node

// Quick validation test for shape glue tabs
import { generateNet } from "../src/core.mjs";

console.log("Testing shape glue tabs functionality...\n");

try {
	// Test 1: Rectangle
	console.log("1. Testing rectangle...");
	const rect = generateNet({ pathData: "M 0,0 L 100,0 L 100,50 L 0,50 Z", depth: 30 });

	if (!rect.svg.includes('id="GLUE_SHAPE"')) {
		throw new Error("Missing GLUE_SHAPE group");
	}
	if (!rect.svg.includes('id="FOLDING_SHAPE"')) {
		throw new Error("Missing FOLDING_SHAPE group");
	}

	const glueShapeMatch = rect.svg.match(/<g id="GLUE_SHAPE"[^>]*>([\s\S]*?)<\/g>/);
	if (!glueShapeMatch || !glueShapeMatch[1].includes('<path')) {
		throw new Error("GLUE_SHAPE should contain path elements");
	}

	console.log("   ✓ Rectangle has glue tabs");

	// Test 2: Circle (should have star-pattern glue tabs)
	console.log("2. Testing circle...");
	const circle = generateNet({
		svgContent: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>',
		depth: 30
	});

	if (!circle.svg.includes('<circle')) {
		throw new Error("Circle should be preserved as <circle> element");
	}

	const circleGlueShape = circle.svg.match(/<g id="GLUE_SHAPE"[^>]*>([\s\S]*?)<\/g>/);
	const hasCircleShapeTabs = circleGlueShape && circleGlueShape[1].includes('<path');
	if (!hasCircleShapeTabs) {
		throw new Error("Circle should have star-pattern shape glue tabs");
	}

	console.log("   ✓ Circle preserved with star-pattern tabs");

	// Test 3: Rect from SVG
	console.log("3. Testing rect from SVG...");
	const svgRect = generateNet({
		svgContent: '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="100" height="50"/></svg>',
		depth: 30
	});

	const shapeGroup = svgRect.svg.match(/<g id="SHAPE"[^>]*>([\s\S]*?)<\/g>/);
	if (!shapeGroup || !shapeGroup[1].includes('<rect')) {
		throw new Error("Rect should be preserved as <rect> elements");
	}

	console.log("   ✓ Rect preserved as <rect> element");

	// Test 4: Check tab count
	console.log("4. Testing tab count...");
	const tabCount = (rect.svg.match(/<g id="GLUE_SHAPE"[^>]*>([\s\S]*?)<\/g>/)[1].match(/<path/g) || []).length;
	if (tabCount < 8) {
		throw new Error(`Expected at least 8 tabs, got ${tabCount}`);
	}

	console.log(`   ✓ Rectangle has ${tabCount} glue tabs`);

	// Test 5: Check groups exist
	console.log("5. Testing group structure...");
	const requiredGroups = ['GLUE_SIDE', 'GLUE_SHAPE', 'FOLDING_SIDE', 'FOLDING_SHAPE', 'SHAPE', 'INFO', 'BG'];
	for (const group of requiredGroups) {
		if (!rect.svg.includes(`id="${group}"`)) {
			throw new Error(`Missing ${group} group`);
		}
	}

	console.log("   ✓ All required groups present");

	console.log("\n✅ All basic tests passed!\n");

} catch (error) {
	console.error(`\n❌ Test failed: ${error.message}\n`);
	process.exit(1);
}
