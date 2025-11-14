"use strict";

let svgPathPropertiesNode = null;
if (typeof window === 'undefined') {
	const { createRequire } = await import('module');
	const requireNode = createRequire(import.meta.url);
	try {
		const mod = requireNode('svg-path-properties');
		svgPathPropertiesNode = mod?.svgPathProperties || mod?.default || null;
	} catch {
		svgPathPropertiesNode = null;
	}
}

function flattenPath(d, { tolerance = 0.5, scale = 1 } = {}) {
	// If in Node and svgPathProperties is available, use it; otherwise in browser use SVGPathElement sampling
	if (svgPathPropertiesNode) {
		const props = new svgPathPropertiesNode(d);
		const len = props.getTotalLength();
		const step = Math.max(tolerance, 0.01);
		const pts = [];
		const n = Math.max(3, Math.ceil(len / step));
		for (let i = 0; i <= n; i++) {
			const l = (i / n) * len;
			const { x, y } = props.getPointAtLength(l);
			const px = x * scale;
			const py = y * scale;
			if (pts.length === 0 || Math.hypot(px - pts[pts.length - 1][0], py - pts[pts.length - 1][1]) > step * 0.25) {
				pts.push([px, py]);
			}
		}
		if (pts.length > 2) {
			const [fx, fy] = pts[0];
			const [lx, ly] = pts[pts.length - 1];
			if (Math.hypot(fx - lx, fy - ly) < step) pts.pop();
		}
		return pts;
	}

	// Browser fallback: use an offscreen SVGPathElement to sample points
	try {
		const svgNS = 'http://www.w3.org/2000/svg';
		const svg = document.createElementNS(svgNS, 'svg');
		const path = document.createElementNS(svgNS, 'path');
		path.setAttribute('d', d);
		svg.appendChild(path);
		// Append offscreen (not in document) is OK for getTotalLength in most browsers
		const len = path.getTotalLength();
		const step = Math.max(tolerance, 0.01);
		const pts = [];
		const n = Math.max(3, Math.ceil(len / step));
		for (let i = 0; i <= n; i++) {
			const l = (i / n) * len;
			const pt = path.getPointAtLength(l);
			const px = pt.x * scale;
			const py = pt.y * scale;
			if (pts.length === 0 || Math.hypot(px - pts[pts.length - 1][0], py - pts[pts.length - 1][1]) > step * 0.25) {
				pts.push([px, py]);
			}
		}
		if (pts.length > 2) {
			const [fx, fy] = pts[0];
			const [lx, ly] = pts[pts.length - 1];
			if (Math.hypot(fx - lx, fy - ly) < step) pts.pop();
		}
		return pts;
	} catch (e) {
		return [];
	}
}

function simplifyColinear(points, epsilon = 0.01) {
	if (points.length <= 3) return points.slice();
	const pts = points.slice();
	const out = [];
	for (let i = 0; i < pts.length; i++) {
		const prev = out.length ? out[out.length - 1] : pts[(i - 1 + pts.length) % pts.length];
		const curr = pts[i];
		const next = pts[(i + 1) % pts.length];
		if (Math.hypot(curr[0] - prev[0], curr[1] - prev[1]) < epsilon) {
			continue;
		}
		const v1x = curr[0] - prev[0], v1y = curr[1] - prev[1];
		const v2x = next[0] - curr[0], v2y = next[1] - curr[1];
		const cross = Math.abs(v1x * v2y - v1y * v2x);
		const len1 = Math.hypot(v1x, v1y), len2 = Math.hypot(v2x, v2y);
		const area2 = cross;
		const norm = len1 + len2;
		if (norm > 0 && area2 / norm < epsilon) continue;
		out.push(curr);
	}
	if (out.length > 2) {
		const [fx, fy] = out[0];
		const [lx, ly] = out[out.length - 1];
		if (Math.hypot(fx - lx, fy - ly) < epsilon) out.pop();
	}
	return out;
}

export { flattenPath, simplifyColinear };
