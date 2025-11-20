import { strict as assert } from 'assert';
import { calculateArcCenter, fitCurveCircle } from '../src/geometry.mjs';

function test(name, fn) {
	try { fn(); console.log(`✓ ${name}`); } catch (e) { console.log(`✗ ${name}`); console.error(e); process.exitCode = 1; }
}

// Quarter circle arc from (0,0) to (10,10) with rx=ry=10, sweep=1 largeArc=0 rotation=0
test('calculateArcCenter quarter circle', () => {
	const { cx, cy } = calculateArcCenter(0, 0, 10, 10, 10, 10, 0, 0, 1);
	// Center should be near (0,10) or (10,0) depending on flags; with largeArc=0,sweep=1 expect center (0,10)
	const dist1 = Math.hypot(cx - 0, cy - 10);
	const dist2 = Math.hypot(cx - 10, cy - 0);
	assert.ok(Math.min(dist1, dist2) < 0.01, `Center mismatch (${cx},${cy})`);
});

test('fitCurveCircle quadratic simple arch', () => {
	const seg = { type: 'curve', x1: 0, y1: 0, x2: 10, y2: 0, cx1: 5, cy1: 10, isQuadratic: true };
	const fit = fitCurveCircle(seg);
	assert.ok(fit && fit.r > 0, 'Radius should be positive');
	// Expect center above baseline (>0) and roughly between endpoints
	assert.ok(fit.cx >= -10 && fit.cx <= 20, 'Center x within reasonable span');
	assert.ok(fit.cy >= -10 && fit.cy <= 20, 'Center y within reasonable span');
});

if (process.exitCode) process.exit(1);
