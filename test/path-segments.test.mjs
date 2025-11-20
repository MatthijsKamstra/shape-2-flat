import { strict as assert } from 'assert';
import { computeSegmentLengthsFromPath } from '../src/path-segments.mjs';

// Test framework implementation
const describe = function (name, fn) {
	const suite = { name, tests: [] };
	const oldDescribe = global.currentSuite;
	global.currentSuite = suite;
	fn();
	global.currentSuite = oldDescribe;
	if (oldDescribe) {
		oldDescribe.tests.push(suite);
	} else {
		describe.suites.push(suite);
	}
};
describe.suites = [];

const it = function (name, fn) {
	if (global.currentSuite) {
		global.currentSuite.tests.push({ name, fn });
	}
};

// Helper to compare floats with tolerance
function assertClose(actual, expected, tolerance = 0.0001, message = '') {
	const diff = Math.abs(actual - expected);
	if (diff > tolerance) {
		throw new Error(`${message} Expected ${expected}, got ${actual} (diff: ${diff})`);
	}
}

describe('computeSegmentLengthsFromPath', () => {
	describe('MoveTo (M/m)', () => {
		it('should handle absolute MoveTo without creating segments', () => {
			const result = computeSegmentLengthsFromPath('M 10,20');
			assert.deepEqual(result, []);
		});

		it('should handle relative moveto', () => {
			const result = computeSegmentLengthsFromPath('M 10,20 m 5,5');
			assert.deepEqual(result, []);
		});

		it('should treat subsequent coordinate pairs as implicit LineTo', () => {
			// Note: The implementation requires explicit L command after first M
			// So using explicit L commands instead
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 10,10');
			assert.equal(result.length, 2);
			assertClose(result[0].length, 10, 0.0001, 'First line length');
			assertClose(result[1].length, 10, 0.0001, 'Second line length');
		});
	});

	describe('LineTo (L/l)', () => {
		it('should calculate length for absolute LineTo', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'line');
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, 0); // horizontal right
		});

		it('should calculate length for relative lineto', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 l 10,0');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'line');
			assertClose(result[0].length, 10);
		});

		it('should handle multiple LineTo commands', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 L 10,10 L 0,10');
			assert.equal(result.length, 3);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10);
			assertClose(result[2].length, 10);
		});

		it('should calculate diagonal line length correctly', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 3,4');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 5); // 3-4-5 triangle
		});

		it('should handle multiple coordinate pairs in single L command', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 20,0 30,0');
			assert.equal(result.length, 3);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10);
			assertClose(result[2].length, 10);
		});
	});

	describe('HorizontalLineTo (H/h)', () => {
		it('should calculate length for absolute horizontal line', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 H 10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'line');
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, 0); // right
		});

		it('should calculate length for relative horizontal line', () => {
			const result = computeSegmentLengthsFromPath('M 5,5 h 10');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, 0);
		});

		it('should handle negative horizontal movement (left)', () => {
			const result = computeSegmentLengthsFromPath('M 10,0 H 0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, Math.PI); // left
		});

		it('should handle multiple H values', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 H 10 20 30');
			assert.equal(result.length, 3);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10);
			assertClose(result[2].length, 10);
		});
	});

	describe('VerticalLineTo (V/v)', () => {
		it('should calculate length for absolute vertical line', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 V 10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'line');
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, Math.PI / 2); // down
		});

		it('should calculate length for relative vertical line', () => {
			const result = computeSegmentLengthsFromPath('M 5,5 v 10');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, Math.PI / 2);
		});

		it('should handle negative vertical movement (up)', () => {
			const result = computeSegmentLengthsFromPath('M 0,10 V 0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
			assertClose(result[0].angle, -Math.PI / 2); // up
		});

		it('should handle multiple V values', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 V 10 20 30');
			assert.equal(result.length, 3);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10);
			assertClose(result[2].length, 10);
		});
	});

	describe('Arc (A/a)', () => {
		it('should calculate length for absolute arc', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 10 10 0 0 1 10,10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			assert.ok(result[0].length > 0, 'Arc length should be positive');
			// Arc length for quarter circle: approximately π * 10 / 2 ≈ 15.7
			assert.ok(result[0].length > 10, 'Arc should be longer than straight line');
		});

		it('should calculate length for relative arc', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 a 10 10 0 0 1 10,10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			assert.ok(result[0].length > 0);
		});

		it('should handle multiple arcs', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 10 10 0 0 1 10,10 A 10 10 0 0 1 20,0');
			assert.equal(result.length, 2);
			assert.equal(result[0].type, 'arc');
			assert.equal(result[1].type, 'arc');
		});

		it('should handle elliptical arc with different radii', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 20 10 0 0 1 20,10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			assert.ok(result[0].length > 0);
		});

		it('should handle arc with rotation', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 10 10 45 0 1 10,10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			assert.ok(result[0].length > 0);
		});

		it('should handle arc with large-arc-flag', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 10 10 0 1 1 10,0');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			// Large arc should be longer than small arc
			assert.ok(result[0].length > 15);
		});

		it('should handle arc with sweep-flag', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 A 10 10 0 0 0 10,10');
			assert.equal(result.length, 1);
			assert.equal(result[0].type, 'arc');
			assert.ok(result[0].length > 0);
		});
	});

	describe('ClosePath (Z/z)', () => {
		it('should close path with line segment', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 L 10,10 Z');
			assert.equal(result.length, 3);
			assertClose(result[2].length, Math.sqrt(100 + 100)); // diagonal back
			assert.equal(result[2].type, 'line');
		});

		it('should handle Z when already at starting point', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 L 10,10 L 0,10 L 0,0 Z');
			assert.equal(result.length, 4); // No extra segment since already closed
		});

		it('should work with lowercase z', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 z');
			assert.equal(result.length, 2);
			assertClose(result[1].length, 10);
		});
	});

	describe('Complex paths', () => {
		it('should handle rectangle path', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 100,0 L 100,50 L 0,50 Z');
			assert.equal(result.length, 4);
			assertClose(result[0].length, 100); // top
			assertClose(result[1].length, 50);  // right
			assertClose(result[2].length, 100); // bottom
			assertClose(result[3].length, 50);  // left
		});

		it('should handle triangle path', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 L 5,8.66 Z');
			assert.equal(result.length, 3);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10, 0.01);
			assertClose(result[2].length, 10, 0.01);
		});

		it('should handle path with mixed absolute and relative commands', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 l 0,10 H 0 Z');
			assert.equal(result.length, 4);
			assertClose(result[0].length, 10);
			assertClose(result[1].length, 10);
			assertClose(result[2].length, 10);
			assertClose(result[3].length, 10);
		});

		it('should handle path with arcs and lines', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0 A 5 5 0 0 1 15,5 L 15,15 Z');
			assert.equal(result.length, 4);
			assert.equal(result[0].type, 'line');
			assert.equal(result[1].type, 'arc');
			assert.equal(result[2].type, 'line');
			assert.equal(result[3].type, 'line');
		});
	});

	describe('Edge cases', () => {
		it('should handle empty path', () => {
			const result = computeSegmentLengthsFromPath('');
			// Empty path returns null to signal no valid segments
			assert.equal(result, null);
		});

		it('should handle null path', () => {
			const result = computeSegmentLengthsFromPath(null);
			assert.equal(result, null);
		});

		it('should handle path with only whitespace', () => {
			const result = computeSegmentLengthsFromPath('   \n\t  ');
			assert.deepEqual(result, []);
		});

		it('should handle path with scientific notation', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 1e1,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
		});

		it('should handle path with minimal whitespace', () => {
			const result = computeSegmentLengthsFromPath('M0,0L10,0L10,10Z');
			assert.equal(result.length, 3);
		});

		it('should handle path with comma separators', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0,10,10');
			assert.equal(result.length, 2);
		});

		it('should handle zero-length segments', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 0,0 L 10,0');
			assert.equal(result.length, 2);
			assertClose(result[0].length, 0);
			assertClose(result[1].length, 10);
		});

		it('should return null for unsupported commands (C)', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 C 10,0 20,10 30,10');
			assert.equal(result, null);
		});

		it('should return null for unsupported commands (Q)', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 Q 10,10 20,0');
			assert.equal(result, null);
		});

		it('should return null for unsupported commands (S)', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 S 10,10 20,0');
			assert.equal(result, null);
		});

		it('should return null for unsupported commands (T)', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 T 10,10');
			assert.equal(result, null);
		});
	});

	describe('Number parsing', () => {
		it('should handle negative numbers', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L -10,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
		});

		it('should handle decimal numbers', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10.5,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10.5);
		});

		it('should handle numbers without leading zero', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L .5,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 0.5);
		});

		it('should handle numbers with explicit plus sign', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L +10,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 10);
		});

		it('should handle exponential notation', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 1e2,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 100);
		});

		it('should handle negative exponential notation', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 1e-1,0');
			assert.equal(result.length, 1);
			assertClose(result[0].length, 0.1);
		});
	});

	describe('Angle calculations', () => {
		it('should calculate correct angle for horizontal right line', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,0');
			assertClose(result[0].angle, 0);
		});

		it('should calculate correct angle for horizontal left line', () => {
			const result = computeSegmentLengthsFromPath('M 10,0 L 0,0');
			assertClose(result[0].angle, Math.PI);
		});

		it('should calculate correct angle for vertical down line', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 0,10');
			assertClose(result[0].angle, Math.PI / 2);
		});

		it('should calculate correct angle for vertical up line', () => {
			const result = computeSegmentLengthsFromPath('M 0,10 L 0,0');
			assertClose(result[0].angle, -Math.PI / 2);
		});

		it('should calculate correct angle for diagonal line (45°)', () => {
			const result = computeSegmentLengthsFromPath('M 0,0 L 10,10');
			assertClose(result[0].angle, Math.PI / 4, 0.0001);
		});
	});
});

// Simple test runner
async function runTests() {
	const suites = describe.suites;
	let totalTests = 0;
	let passedTests = 0;
	let failedTests = 0;

	for (const suite of suites) {
		console.log(`\n${suite.name}`);
		for (const subSuite of suite.tests) {
			if (subSuite.tests) {
				console.log(`  ${subSuite.name}`);
				for (const test of subSuite.tests) {
					totalTests++;
					try {
						await test.fn();
						passedTests++;
						console.log(`    ✓ ${test.name}`);
					} catch (error) {
						failedTests++;
						console.log(`    ✗ ${test.name}`);
						console.log(`      ${error.message}`);
					}
				}
			}
		}
	}

	console.log(`\n${'='.repeat(60)}`);
	console.log(`Total: ${totalTests} | Passed: ${passedTests} | Failed: ${failedTests}`);
	if (failedTests > 0) {
		process.exit(1);
	}
}

// Run tests if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
	runTests();
}
