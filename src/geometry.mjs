"use strict";

// Lazy load svg-path-properties in Node; browser fallback uses SVGPathElement
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

function getTotalLength(pathData) {
	try {
		if (svgPathPropertiesNode) {
			const props = new svgPathPropertiesNode(pathData);
			return props.getTotalLength();
		}
		if (typeof document !== 'undefined') {
			const svgNS = 'http://www.w3.org/2000/svg';
			const svg = document.createElementNS(svgNS, 'svg');
			const path = document.createElementNS(svgNS, 'path');
			path.setAttribute('d', pathData);
			svg.appendChild(path);
			return path.getTotalLength();
		}
	} catch {
		// fall through to approximation
	}
	return 0;
}

function arcLength(x0, y0, rx, ry, xRot, largeArc, sweep, x1, y1) {
	const d = `M ${x0},${y0} A ${rx} ${ry} ${xRot} ${largeArc} ${sweep} ${x1} ${y1}`;
	const len = getTotalLength(d);
	if (len) return len;
	// fallback straight-line distance
	return Math.hypot(x1 - x0, y1 - y0);
}

function curveLength(pathData) {
	const len = getTotalLength(pathData);
	if (len) return len;
	// crude fallback: distance between first and last coordinate pair
	const match = pathData.match(/M\s*([\d.+-]+)[,\s]+([\d.+-]+).*[A-Z]\s*([\d.+-]+)[,\s]+([\d.+-]+)\s*$/i);
	if (match) {
		const x0 = parseFloat(match[1]);
		const y0 = parseFloat(match[2]);
		const x1 = parseFloat(match[3]);
		const y1 = parseFloat(match[4]);
		return Math.hypot(x1 - x0, y1 - y0);
	}
	return 0;
}

function calculateArcCenter(x1, y1, x2, y2, rx, ry, xRot, largeArc, sweep) {
	const phi = (xRot * Math.PI) / 180;
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const dx = (x1 - x2) / 2;
	const dy = (y1 - y2) / 2;
	let x1p = cosPhi * dx + sinPhi * dy;
	let y1p = -sinPhi * dx + cosPhi * dy;
	const lambda = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
	if (lambda > 1) {
		const scl = Math.sqrt(lambda);
		rx *= scl;
		ry *= scl;
	}
	const sign = largeArc !== sweep ? 1 : -1;
	const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p) / (rx * rx * y1p * y1p + ry * ry * x1p * x1p));
	const coef = sign * Math.sqrt(sq);
	const cxp = coef * (rx * y1p) / ry;
	const cyp = -coef * (ry * x1p) / rx;
	const cx = cosPhi * cxp - sinPhi * cyp + (x1 + x2) / 2;
	const cy = sinPhi * cxp + cosPhi * cyp + (y1 + y2) / 2;
	return { cx, cy };
}

function fitCurveCircle(seg) {
	if (!seg) return null;
	let midX, midY;
	if (seg.isQuadratic && seg.cx1 !== undefined) {
		midX = 0.25 * seg.x1 + 0.5 * seg.cx1 + 0.25 * seg.x2;
		midY = 0.25 * seg.y1 + 0.5 * seg.cy1 + 0.25 * seg.y2;
	} else if (seg.cx1 !== undefined && seg.cx2 !== undefined) {
		midX = 0.125 * seg.x1 + 0.375 * seg.cx1 + 0.375 * seg.cx2 + 0.125 * seg.x2;
		midY = 0.125 * seg.y1 + 0.375 * seg.cy1 + 0.375 * seg.cy2 + 0.125 * seg.y2;
	} else {
		midX = (seg.x1 + seg.x2) / 2;
		midY = (seg.y1 + seg.y2) / 2;
	}
	const p1x = seg.x1, p1y = seg.y1;
	const p2x = midX, p2y = midY;
	const p3x = seg.x2, p3y = seg.y2;
	const d = 2 * (p1x * (p2y - p3y) + p2x * (p3y - p1y) + p3x * (p1y - p2y));
	let cx0, cy0, r0;
	if (Math.abs(d) < 1e-6) {
		cx0 = (p1x + p3x) / 2;
		cy0 = (p1y + p3y) / 2;
		r0 = Math.hypot(p3x - p1x, p3y - p1y) / 2;
	} else {
		const p1Sq = p1x * p1x + p1y * p1y;
		const p2Sq = p2x * p2x + p2y * p2y;
		const p3Sq = p3x * p3x + p3y * p3y;
		cx0 = (p1Sq * (p2y - p3y) + p2Sq * (p3y - p1y) + p3Sq * (p1y - p2y)) / d;
		cy0 = (p1Sq * (p3x - p2x) + p2Sq * (p1x - p3x) + p3Sq * (p2x - p1x)) / d;
		r0 = Math.hypot(cx0 - p1x, cy0 - p1y);
	}
	return { cx: cx0, cy: cy0, r: r0 };
}

export { arcLength, calculateArcCenter, curveLength, fitCurveCircle };
