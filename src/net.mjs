"use strict";

function polygonArea(points) {
	let a = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		a += x1 * y2 - x2 * y1;
	}
	return Math.abs(a) / 2;
}

function perimeter(points) {
	let p = 0;
	for (let i = 0; i < points.length; i++) {
		const [x1, y1] = points[i];
		const [x2, y2] = points[(i + 1) % points.length];
		p += Math.hypot(x2 - x1, y2 - y1);
	}
	return p;
}

function edgeVec(a, b) {
	return [b[0] - a[0], b[1] - a[1]];
}

function centroid(points) {
	let x = 0, y = 0;
	for (const p of points) { x += p[0]; y += p[1]; }
	return [x / points.length, y / points.length];
}

function rotatePoint([x, y], [cx, cy], angle) {
	const s = Math.sin(angle), c = Math.cos(angle);
	const dx = x - cx, dy = y - cy;
	return [cx + dx * c - dy * s, cy + dx * s + dy * c];
}

function rotatePolygon(points, angle) {
	const c = centroid(points);
	return points.map(p => rotatePoint(p, c, angle));
}

function mirrorPolygonHoriz(points) {
	const c = centroid(points);
	return points.map(([x, y]) => [2 * c[0] - x, y]);
}

function makeNet(poly, depth, { minSegment = 0.5, edgeLengths } = {}) {
	// 1) Rotate polygon so the longest edge becomes vertical
	const edgeData = [];
	for (let i = 0; i < poly.length; i++) {
		const a = poly[i];
		const b = poly[(i + 1) % poly.length];
		const w = Math.hypot(b[0] - a[0], b[1] - a[1]);
		edgeData.push({ i, a, b, w });
	}
	const longestIdx = edgeData.reduce((mi, e, idx, arr) => (e.w > arr[mi].w ? idx : mi), 0);
	const v = edgeVec(edgeData[longestIdx].a, edgeData[longestIdx].b);
	const theta = Math.atan2(v[1], v[0]);
	const rotateBy = (Math.PI / 2) - theta; // rotate so longest edge vertical
	const c0 = centroid(poly);
	const base = rotatePolygon(poly, rotateBy);
	const cBase = centroid(base);

	// Recompute edges after rotation for lengths in order starting at longest edge
	const edgesOrdered = [];
	for (let k = 0; k < base.length; k++) {
		const idx = (longestIdx + k) % base.length;
		const a = base[idx];
		const b = base[(idx + 1) % base.length];
		const h = Math.hypot(b[0] - a[0], b[1] - a[1]);
		edgesOrdered.push({ idx, a, b, h });
	}

	// Determine side rectangle heights (and types when provided)
	let segments = [];
	if (Array.isArray(edgeLengths) && edgeLengths.length > 0) {
		// Reorder provided lengths to start from longest straight edge (edgesOrdered[0].h)
		const target = edgesOrdered[0].h;
		let startIdx = 0;
		let bestDiff = Infinity;
		for (let i = 0; i < edgeLengths.length; i++) {
			const diff = Math.abs(edgeLengths[i].length - target);
			if (edgeLengths[i].type === 'line' && diff < bestDiff) { bestDiff = diff; startIdx = i; }
		}
		const reordered = edgeLengths.slice(startIdx).concat(edgeLengths.slice(0, startIdx));
		segments = reordered.map(s => ({ h: s.length, type: s.type || 'line' }));
	} else {
		// Default from rotated polygon edges
		segments = edgesOrdered.map(e => ({ h: e.h, type: 'line' }));
	}

	// Merge small segments into previous if below threshold (preserve previous type)
	const mergedSegs = [];
	for (const s of segments) {
		if (mergedSegs.length === 0) { mergedSegs.push({ ...s }); continue; }
		if (s.h < minSegment) {
			mergedSegs[mergedSegs.length - 1].h += s.h;
		} else {
			mergedSegs.push({ ...s });
		}
	}
	const sideRects = mergedSegs.map(s => ({ w: depth, h: s.h, type: s.type }));

	// Alignment data for the first (longest) edge on base
	const firstEdge = edgesOrdered[0];
	const xEdge = (firstEdge.a[0] + firstEdge.b[0]) / 2;
	const yMinEdge = Math.min(firstEdge.a[1], firstEdge.b[1]);
	const yMaxEdge = Math.max(firstEdge.a[1], firstEdge.b[1]);

	// Prepare alignment for mirrored base (same edge index)
	const baseMirror = mirrorPolygonHoriz(base);
	const mirrorA = baseMirror[firstEdge.idx];
	const mirrorB = baseMirror[(firstEdge.idx + 1) % baseMirror.length];
	const xEdgeMirror = (mirrorA[0] + mirrorB[0]) / 2;
	const yMinEdgeMirror = Math.min(mirrorA[1], mirrorB[1]);
	const yMaxEdgeMirror = Math.max(mirrorA[1], mirrorB[1]);

	const P = perimeter(base);
	const A = polygonArea(base);
	return {
		base,
		baseMirror,
		sideRects,
		metrics: { perimeter: P, area: A, faces: 2 },
		anchors: { longestIdx },
		align: { xEdge, yMinEdge, yMaxEdge },
		alignMirror: { xEdge: xEdgeMirror, yMinEdge: yMinEdgeMirror, yMaxEdge: yMaxEdgeMirror },
		rotation: { angle: rotateBy, centroidOriginal: c0, centroidBase: cBase },
	};
}

export { makeNet, perimeter, polygonArea };

