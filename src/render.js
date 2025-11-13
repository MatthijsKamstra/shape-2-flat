"use strict";

function bboxOfPoints(points) {
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (const [x, y] of points) {
		if (x < minX) minX = x;
		if (y < minY) minY = y;
		if (x > maxX) maxX = x;
		if (y > maxY) maxY = y;
	}
	return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

function translate(points, dx, dy) {
	return points.map(([x, y]) => [x + dx, y + dy]);
}

function polyToPath(points) {
	return `M ${points.map(p => p.join(",")).join(" L ")} Z`;
}

function rectPath(x, y, w, h) {
	return `M ${x},${y} L ${x + w},${y} L ${x + w},${y + h} L ${x},${y + h} Z`;
}

function dashedLine(x1, y1, x2, y2) {
	return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#00a" stroke-width="0.5" stroke-dasharray="4,3"/>`;
}

function renderNetSvg(net, { margin = 10, unit = "px", page } = {}) {
	const gap = 0; // connect parts without gaps
	// Arrange: base (left), side stack (center), mirrored base (right)
	// vertical stack height
	const totalStripH = net.sideRects.reduce((s, r) => s + r.h, 0);

	// Place side stack first at (sx, sy)
	const sx = margin;
	const sy = margin;

	// Align base so its longest edge runs vertically alongside sx (left side of stack)
	// We know net.align.yMinEdge..yMaxEdge in base-local coordinates; move base so that edge Y range matches [sy, sy+firstRect.h]
	const firstRectH = net.sideRects[0]?.h || 0;
	const baseOffsetX = sx - net.align.xEdge; // move edge center to sx; since edge is vertical, this aligns left contact visually
	const baseOffsetY = sy - net.align.yMinEdge;
	const base = translate(net.base, baseOffsetX, baseOffsetY);
	const baseBox = bboxOfPoints(base);

	// Now stack rectangles at (sx, sy)
	let cy = sy;
	const stacked = net.sideRects.map(seg => {
		const r = { x: sx, y: cy, w: seg.w, h: seg.h };
		cy += seg.h;
		return r;
	});

	// Mirror base placed to the right of stack by depth, aligned on the same edge range
	const mirrorOffsetX = sx + net.sideRects[0].w + gap - net.alignMirror.xEdge;
	const mirrorOffsetY = sy - net.alignMirror.yMinEdge;
	const baseMirror = translate(net.baseMirror, mirrorOffsetX, mirrorOffsetY);
	const mirrorBox = bboxOfPoints(baseMirror);


	const contentWidth = page?.width ?? (Math.max(baseBox.maxX, sy + totalStripH, mirrorBox.maxX) + margin);
	const contentHeight = page?.height ?? (Math.max(baseBox.maxY, sy + totalStripH, mirrorBox.maxY) + margin);

	const baseStyle = 'fill="white" stroke="#000" stroke-width="0.6"';
	const extrudeStyle = 'fill="white" stroke="#000" stroke-width="0.6"';
	const tabStyle = 'fill="#e5e5e5"';

	// Center the whole group within the page bounds (if page provided) or content size
	// Compute group bbox
	const rectMinX = Math.min(...stacked.map(r => r.x));
	const rectMaxX = Math.max(...stacked.map(r => r.x + r.w));
	const rectMinY = Math.min(...stacked.map(r => r.y));
	const rectMaxY = Math.max(...stacked.map(r => r.y + r.h));
	const groupMinX = Math.min(baseBox.minX, rectMinX, mirrorBox.minX);
	const groupMaxX = Math.max(baseBox.maxX, rectMaxX, mirrorBox.maxX);
	const groupMinY = Math.min(baseBox.minY, rectMinY, mirrorBox.minY);
	const groupMaxY = Math.max(baseBox.maxY, rectMaxY, mirrorBox.maxY);

	const pageW = contentWidth; // in same units as coords
	const pageH = contentHeight;
	const dx = (pageW - (groupMaxX - groupMinX)) / 2 - groupMinX;
	const dy = (pageH - (groupMaxY - groupMinY)) / 2 - groupMinY;

	const baseC = translate(base, dx, dy);
	const mirrorC = translate(baseMirror, dx, dy);
	const stackedC = stacked.map(r => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h }));
	// no tabs

	// Build grouped output: SHAPE (model), GLUE (tabs), DESIGN (placeholder)
	const shapeParts = [];
	shapeParts.push(`<path d="${polyToPath(baseC)}" ${baseStyle}/>`);
	shapeParts.push(`<path d="${polyToPath(mirrorC)}" ${baseStyle}/>`);
	for (const r of stackedC) {
		shapeParts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extrudeStyle}/>`);
	}

	// Glue tabs: 7 mm with 45° angled ends on all four sides; folding lines separated
	const tabW = 7;
	const foldStyle = 'fill="none" stroke="#FFF" stroke-width="0.4" stroke-dasharray="2,1"';
	const glueParts = [];
	const foldParts = [];
	for (const r of stackedC) {
		// Left tab (vertical)
		{
			const xFold = r.x;
			const xOut = r.x - tabW;
			const yTop = r.y;
			const yBot = r.y + r.h;
			const vDelta = Math.min(tabW, r.h / 2);
			const d = `M ${xFold},${yTop} L ${xOut},${yTop + vDelta} L ${xOut},${yBot - vDelta} L ${xFold},${yBot} Z`;
			glueParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldParts.push(`<path d="M ${xFold},${yTop} L ${xFold},${yBot}" ${foldStyle}/>`);
		}
		// Right tab (vertical)
		{
			const xFold = r.x + r.w;
			const xOut = r.x + r.w + tabW;
			const yTop = r.y;
			const yBot = r.y + r.h;
			const vDelta = Math.min(tabW, r.h / 2);
			const d = `M ${xFold},${yTop} L ${xOut},${yTop + vDelta} L ${xOut},${yBot - vDelta} L ${xFold},${yBot} Z`;
			glueParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldParts.push(`<path d="M ${xFold},${yTop} L ${xFold},${yBot}" ${foldStyle}/>`);
		}
		// Top tab (horizontal)
		{
			const yFold = r.y;
			const yOut = r.y - tabW;
			const xLeft = r.x;
			const xRight = r.x + r.w;
			const hDelta = Math.min(tabW, r.w / 2);
			const d = `M ${xLeft},${yFold} L ${xLeft + hDelta},${yOut} L ${xRight - hDelta},${yOut} L ${xRight},${yFold} Z`;
			glueParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldParts.push(`<path d="M ${xLeft},${yFold} L ${xRight},${yFold}" ${foldStyle}/>`);
		}
		// Bottom tab (horizontal)
		{
			const yFold = r.y + r.h;
			const yOut = r.y + r.h + tabW;
			const xLeft = r.x;
			const xRight = r.x + r.w;
			const hDelta = Math.min(tabW, r.w / 2);
			const d = `M ${xLeft},${yFold} L ${xLeft + hDelta},${yOut} L ${xRight - hDelta},${yOut} L ${xRight},${yFold} Z`;
			glueParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldParts.push(`<path d="M ${xLeft},${yFold} L ${xRight},${yFold}" ${foldStyle}/>`);
		}
	}

	let parts = [];
	parts.push(`<g id="GLUE">${glueParts.join("\n")}</g>`);
	parts.push(`<g id="SHAPE">${shapeParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_LINES">${foldParts.join("\n")}</g>`);
	parts.push(`<g id="CUT_LINES"></g>`);
	parts.push(`<g id="DESIGN"></g>`);

	// no glue tabs

	const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<svg xmlns="http://www.w3.org/2000/svg" width="${contentWidth}${unit}" height="${contentHeight}${unit}" viewBox="0 0 ${contentWidth} ${contentHeight}">\n` +
		`<rect x="0" y="0" width="100%" height="100%" fill="white" id="BG"/>\n` +
		parts.join("\n") +
		`\n</svg>\n`;

	const meta = { faces: net.metrics.faces, perimeter: net.metrics.perimeter, area: net.metrics.area };
	return { svg, meta };
}

module.exports = { renderNetSvg };
