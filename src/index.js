"use strict";

async function generateNetFromSvg({ svgContent, pathData, depth = 50, height, scale = 1, tolerance = 0.5, minSegment = 0.5, margin = 10, unit = "px" }) {
	// Dynamically import ESM modules (they may have browser-friendly implementations)
	const { extractPathInfo } = (await import('./svg-io.mjs'));
	const { flattenPath, simplifyColinear } = (await import('./path-flatten.mjs'));
	const { computeSegmentLengthsFromPath } = (await import('./path-segments.mjs'));
	const { extractLinearPolygon } = (await import('./path-linear.mjs'));
	const { makeNet } = (await import('./net.mjs'));
	const { renderNetSvg } = (await import('./render.mjs'));

	const info = pathData ? { d: pathData, kind: 'path' } : extractPathInfo(svgContent);
	const d = info.d;
	if (!d) throw new Error("No SVG path data found");
	// Prefer original vertices if the path uses only linear commands (M/L/H/V/Z)
	let polyRaw = extractLinearPolygon(d);
	if (polyRaw) {
		// apply scale to linear points
		if (scale !== 1) polyRaw = polyRaw.map(([x, y]) => [x * scale, y * scale]);
	} else {
		polyRaw = flattenPath(d, { tolerance, scale });
		if (polyRaw.length < 3 && tolerance > 0.1) {
			const finerTol = Math.max(tolerance / 2, 0.1);
			polyRaw = flattenPath(d, { tolerance: finerTol, scale });
		}
	}
	if (polyRaw.length < 3 && tolerance > 0.1) {
		// Retry with finer sampling for very short paths
		const finerTol = Math.max(tolerance / 2, 0.1);
		polyRaw = flattenPath(d, { tolerance: finerTol, scale });
	}
	let poly = simplifyColinear(polyRaw);
	if (poly.length < 3) {
		// Fallback: use raw flattened points if simplification removed too much
		poly = polyRaw;
	}
	if (poly.length < 3) throw new Error("Path must form a polygon with at least 3 points");
	const depthVal = typeof depth === "number" ? depth : (typeof height === "number" ? height : 50);
	// Experimental: compute segment lengths from original path (lines and arcs) to drive side rectangles
	let edgeLengths;
	let hasArcs = false;
	try {
		const segs = computeSegmentLengthsFromPath(d);
		if (segs && segs.length) {
			hasArcs = segs.some(s => s.type === 'arc');
			if (info.kind === 'circle' || info.kind === 'ellipse') {
				// Combine all arc segments into a single side-rect with total circumference
				const totalArc = segs.filter(s => s.type === 'arc').reduce((a, s) => a + s.length, 0);
				edgeLengths = totalArc > 0 ? [{ type: 'arc', length: totalArc }] : segs;
			} else {
				edgeLengths = segs;
			}
		}
	} catch { }
	const net = makeNet(poly, depthVal, { minSegment, edgeLengths });
	const originalShape = { ...info, hasArcs: hasArcs || info.kind === 'circle' || info.kind === 'ellipse' };
	const { svg, meta } = renderNetSvg(net, { margin, unit, page: { width: 210, height: 297 }, originalShape, scale });
	return { svg, meta };
}

module.exports = { generateNetFromSvg };
