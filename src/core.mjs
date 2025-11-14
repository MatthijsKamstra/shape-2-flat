"use strict";

import { makeNet } from "./net.mjs";
import { flattenPath, simplifyColinear } from "./path-flatten.mjs";
import { extractLinearPolygon } from "./path-linear.mjs";
import { computeSegmentLengthsFromPath } from "./path-segments.mjs";
import { renderNetSvg } from "./render.mjs";
import { extractPathInfo } from "./svg-io.mjs";

/**
 * Generate net SVG + meta.
 * @param {Object} opts
 * @param {string} [opts.svgContent] - Raw SVG text.
 * @param {string} [opts.pathData]   - Direct path d string.
 * @param {number} [opts.depth=50]
 * @param {number} [opts.height]     - Deprecated alias.
 * @param {number} [opts.scale=1]
 * @param {number} [opts.tolerance=0.5]
 * @param {number} [opts.minSegment=0.5]
 * @param {number} [opts.margin=10]
 * @param {string} [opts.unit="mm"]
 */
function generateNet(opts = {}) {
	const {
		svgContent,
		pathData,
		depth = 50,
		height,
		scale = 1,
		tolerance = 0.5,
		minSegment = 0.5,
		margin = 10,
		unit = "mm",
	} = opts;

	const info = pathData ? { d: pathData, kind: "path" } : extractPathInfo(svgContent);
	const d = info.d;
	if (!d) throw new Error("No SVG path data found");

	let polyRaw = extractLinearPolygon(d);
	if (polyRaw) {
		if (scale !== 1) polyRaw = polyRaw.map(([x, y]) => [x * scale, y * scale]);
	} else {
		polyRaw = flattenPath(d, { tolerance, scale });
		if (polyRaw.length < 3 && tolerance > 0.1) {
			const finerTol = Math.max(tolerance / 2, 0.1);
			polyRaw = flattenPath(d, { tolerance: finerTol, scale });
		}
	}
	if (polyRaw.length < 3 && tolerance > 0.1) {
		const finerTol = Math.max(tolerance / 2, 0.1);
		polyRaw = flattenPath(d, { tolerance: finerTol, scale });
	}

	let poly = simplifyColinear(polyRaw);
	if (poly.length < 3) poly = polyRaw;
	if (poly.length < 3) throw new Error("Path must form a polygon with at least 3 points");

	const depthVal = typeof depth === "number" ? depth : (typeof height === "number" ? height : 50);

	let edgeLengths;
	let hasArcs = false;
	try {
		const segs = computeSegmentLengthsFromPath(d);
		if (segs && segs.length) {
			hasArcs = segs.some(s => s.type === "arc");
			if (info.kind === "circle" || info.kind === "ellipse") {
				const totalArc = segs.filter(s => s.type === "arc").reduce((a, s) => a + s.length, 0);
				edgeLengths = totalArc > 0 ? [{ type: "arc", length: totalArc }] : segs;
			} else {
				edgeLengths = segs;
			}
		}
	} catch { }

	const net = makeNet(poly, depthVal, { minSegment, edgeLengths });
	const originalShape = { ...info, hasArcs: hasArcs || info.kind === "circle" || info.kind === "ellipse" };
	const { svg, meta } = renderNetSvg(net, {
		margin,
		unit,
		page: { width: 210, height: 297 },
		originalShape,
		scale,
	});
	return { svg, meta };
}
export { generateNet };

// Attach to window for browser usage if present
try {
	if (typeof window !== "undefined") {
		window.Shape2Flat = window.Shape2Flat || {};
		window.Shape2Flat.generateNet = generateNet;
	}
} catch { }
