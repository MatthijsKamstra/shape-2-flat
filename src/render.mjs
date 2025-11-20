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

function renderNetSvg(net, { margin = 10, unit = "px", page, originalShape, scale = 1 } = {}) {
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
	const depthVal = net.sideRects[0]?.w || 0;
	const baseOffsetX = sx - net.align.xEdge; // move edge center to sx; since edge is vertical, this aligns left contact visually
	const baseOffsetY = sy - net.align.yMinEdge;
	const base = translate(net.base, baseOffsetX, baseOffsetY);
	const baseBox = bboxOfPoints(base);
	const baseFootprint = { width: baseBox.width, height: baseBox.height };

	// Now stack rectangles at (sx, sy)
	let cy = sy;
	const stacked = net.sideRects.map(seg => {
		const r = { x: sx, y: cy, w: seg.w, h: seg.h, type: seg.type || 'line' };
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

	const baseStyle = 'fill="#e5e5e5" stroke="#000" stroke-width="0.6"';
	const mirrorStyle = 'fill="white" stroke="#000" stroke-width="0.6"';
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
	const stackedC = stacked.map(r => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h, type: r.type }));
	// no tabs

	// Build grouped output: SHAPE (model), GLUE (tabs), DESIGN (placeholder)
	const shapeParts = [];
	const useCircle = originalShape && originalShape.kind === 'circle' && originalShape.shapeParams;
	const useEllipse = originalShape && originalShape.kind === 'ellipse' && originalShape.shapeParams;
	const useRect = originalShape && originalShape.kind === 'rect';
	if (useCircle || useEllipse) {
		// Align to the side stack: base's rightmost point touches stack left edge; mirror's leftmost touches stack right edge
		const stackLeftX = stackedC[0].x;
		const stackRightX = stackedC[0].x + stackedC[0].w;
		const stackTopY = stackedC[0].y;
		const stackMidY = stackTopY + (stackedC.reduce((s, r) => s + r.h, 0)) / 2;
		if (useCircle) {
			const { r } = originalShape.shapeParams;
			const baseCx = stackLeftX - r;
			const mirrCx = stackRightX + r;
			shapeParts.push(`<circle cx="${baseCx}" cy="${stackMidY}" r="${r}" ${baseStyle}/>`);
			shapeParts.push(`<circle cx="${mirrCx}" cy="${stackMidY}" r="${r}" ${mirrorStyle}/>`);
		} else {
			const { rx, ry } = originalShape.shapeParams;
			const baseCx = stackLeftX - rx;
			const mirrCx = stackRightX + rx;
			shapeParts.push(`<ellipse cx="${baseCx}" cy="${stackMidY}" rx="${rx}" ry="${ry}" ${baseStyle}/>`);
			shapeParts.push(`<ellipse cx="${mirrCx}" cy="${stackMidY}" rx="${rx}" ry="${ry}" ${mirrorStyle}/>`);
		}
	} else if (useRect) {
		const bBox = bboxOfPoints(baseC);
		const mBox = bboxOfPoints(mirrorC);
		const bw = bBox.maxX - bBox.minX;
		const bh = bBox.maxY - bBox.minY;
		const mw = mBox.maxX - mBox.minX;
		const mh = mBox.maxY - mBox.minY;
		// Render axis-aligned rects matching the aligned base/mirror footprints
		shapeParts.push(`<rect x="${bBox.minX}" y="${bBox.minY}" width="${bw}" height="${bh}" ${baseStyle}/>`);
		shapeParts.push(`<rect x="${mBox.minX}" y="${mBox.minY}" width="${mw}" height="${mh}" ${mirrorStyle}/>`);
	} else if (originalShape && originalShape.kind === 'path' && originalShape.d && net.rotation) {
		const deg = (net.rotation.angle * 180) / Math.PI;
		const c0x = net.rotation.centroidOriginal[0] * scale;
		const c0y = net.rotation.centroidOriginal[1] * scale;
		const cBx = net.rotation.centroidBase[0];
		const cBy = net.rotation.centroidBase[1];
		// Tangent-align: base rightmost to stack left, mirror leftmost to stack right (pre-centering)
		const stackLeftX0 = sx;
		const stackRightX0 = sx + (stacked[0]?.w || 0);
		const deltaBaseX = stackLeftX0 - baseBox.maxX;
		const deltaMirrorX = stackRightX0 - mirrorBox.minX;
		const tBase = `translate(${dx},${dy}) translate(${baseOffsetX + deltaBaseX},${baseOffsetY}) rotate(${deg} ${c0x} ${c0y}) scale(${scale} ${scale})`;
		const tMirror = `translate(${dx},${dy}) translate(${mirrorOffsetX + deltaMirrorX},${mirrorOffsetY}) translate(${cBx},${cBy}) scale(-1 1) translate(${-cBx},${-cBy}) rotate(${deg} ${c0x} ${c0y}) scale(${scale} ${scale})`;
		shapeParts.push(`<path d="${originalShape.d}" transform="${tBase}" ${baseStyle}/>`);
		shapeParts.push(`<path d="${originalShape.d}" transform="${tMirror}" ${mirrorStyle}/>`);
	} else {
		shapeParts.push(`<path d="${polyToPath(baseC)}" ${baseStyle}/>`);
		shapeParts.push(`<path d="${polyToPath(mirrorC)}" ${mirrorStyle}/>`);
	}
	for (const r of stackedC) {
		shapeParts.push(`<rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" ${extrudeStyle}/>`);
	}

	// Glue tabs: 7 mm with 45° angled ends on all four sides; for circle/ellipse/curves use saw-tooth on left/right seams
	const tabW = 7;
	const foldStyle = 'fill="none" stroke="#FFF" stroke-width="0.4" stroke-dasharray="2,1"';
	const glueSideParts = [];
	const glueShapeParts = [];
	const foldSideParts = [];
	const foldShapeParts = [];
	const isCurvyShape = originalShape && ((originalShape.kind === 'circle' || originalShape.kind === 'ellipse') || originalShape.hasArcs);
	const toothPitch = tabW; // spacing along seam for saw-tooth
	for (const r of stackedC) {
		// Left tab (vertical seam with base)
		{
			const xFold = r.x;
			const yTop = r.y;
			const yBot = r.y + r.h;
			const xOut = r.x - tabW;
			if (isCurvyShape && (r.type === 'arc' || r.type === 'curve')) {
				// Saw-tooth triangles along the seam
				let y0 = yTop;
				while (y0 < yBot - 1e-6) {
					const y1 = Math.min(y0 + toothPitch, yBot);
					const ym = (y0 + y1) / 2;
					const d = `M ${xFold},${y0} L ${xOut},${ym} L ${xFold},${y1} Z`;
					glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
					y0 = y1;
				}
			} else {
				const vDelta = Math.min(tabW, r.h / 2);
				const d = `M ${xFold},${yTop} L ${xOut},${yTop + vDelta} L ${xOut},${yBot - vDelta} L ${xFold},${yBot} Z`;
				glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
			}
			foldSideParts.push(`<path d="M ${xFold},${yTop} L ${xFold},${yBot}" ${foldStyle}/>`);
		}
		// Right tab (vertical seam with mirror)
		{
			const xFold = r.x + r.w;
			const yTop = r.y;
			const yBot = r.y + r.h;
			const xOut = r.x + r.w + tabW;
			if (isCurvyShape && (r.type === 'arc' || r.type === 'curve')) {
				let y0 = yTop;
				while (y0 < yBot - 1e-6) {
					const y1 = Math.min(y0 + toothPitch, yBot);
					const ym = (y0 + y1) / 2;
					const d = `M ${xFold},${y0} L ${xOut},${ym} L ${xFold},${y1} Z`;
					glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
					y0 = y1;
				}
			} else {
				const vDelta = Math.min(tabW, r.h / 2);
				const d = `M ${xFold},${yTop} L ${xOut},${yTop + vDelta} L ${xOut},${yBot - vDelta} L ${xFold},${yBot} Z`;
				glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
			}
			foldSideParts.push(`<path d="M ${xFold},${yTop} L ${xFold},${yBot}" ${foldStyle}/>`);
		}
		// Top tab (horizontal)
		{
			const yFold = r.y;
			const yOut = r.y - tabW;
			const xLeft = r.x;
			const xRight = r.x + r.w;
			const hDelta = Math.min(tabW, r.w / 2);
			const d = `M ${xLeft},${yFold} L ${xLeft + hDelta},${yOut} L ${xRight - hDelta},${yOut} L ${xRight},${yFold} Z`;
			glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldSideParts.push(`<path d="M ${xLeft},${yFold} L ${xRight},${yFold}" ${foldStyle}/>`);
		}
		// Bottom tab (horizontal)
		{
			const yFold = r.y + r.h;
			const yOut = r.y + r.h + tabW;
			const xLeft = r.x;
			const xRight = r.x + r.w;
			const hDelta = Math.min(tabW, r.w / 2);
			const d = `M ${xLeft},${yFold} L ${xLeft + hDelta},${yOut} L ${xRight - hDelta},${yOut} L ${xRight},${yFold} Z`;
			glueSideParts.push(`<path d="${d}" ${tabStyle}/>`);
			foldSideParts.push(`<path d="M ${xLeft},${yFold} L ${xRight},${yFold}" ${foldStyle}/>`);
		}
	}

	// Info text: circumference/perimeter equals total side strip length
	const stripLength = net.sideRects.reduce((s, r) => s + r.h, 0);
	const infoLines = [];
	const pushInfoLine = text => {
		const y = 10 + infoLines.length * 6;
		infoLines.push(`<text x="5" y="${y}" font-family="Arial, Helvetica, sans-serif" font-size="6" fill="#000">${text}</text>`);
	};

	pushInfoLine(`Perimeter (strip length): ${stripLength.toFixed(2)} ${unit}`);
	pushInfoLine(`Base footprint: ${baseFootprint.width.toFixed(2)} × ${baseFootprint.height.toFixed(2)} ${unit}`);
	if (depthVal > 0) pushInfoLine(`Depth: ${depthVal.toFixed(2)} ${unit} (panels=${net.sideRects.length})`);
	pushInfoLine(`Scale: ${scale}×, Margin: ${margin}${unit}`);

	if (originalShape?.kind) {
		const edgeCount = Array.isArray(originalShape.edgeLengths) ? originalShape.edgeLengths.length : null;
		let detail = `Input: ${originalShape.kind}`;
		if (edgeCount != null) {
			detail += ` edges=${edgeCount}`;
			if (edgeCount !== net.sideRects.length) detail += ` → panels=${net.sideRects.length}`;
		}
		pushInfoLine(detail);
	}

	net.sideRects.forEach((seg, idx) => {
		const panelHeight = seg.h.toFixed(2);
		const panelWidth = depthVal.toFixed(2);
		pushInfoLine(`Panel ${idx}: type=${seg.type || 'line'}, height=${panelHeight}${unit}, width=${panelWidth}${unit}`);
	});

	if (originalShape?.edgeLengths && Array.isArray(originalShape.edgeLengths)) {
		originalShape.edgeLengths.forEach((seg, i) => {
			const angle = seg.angle !== undefined ? `${(seg.angle * 180 / Math.PI).toFixed(1)}°` : 'N/A';
			pushInfoLine(`Edge ${i}: type=${seg.type}, length=${seg.length.toFixed(2)}${unit}, angle=${angle}`);
		});
	}

	const info = infoLines.join('\n');

	let parts = [];
	parts.push(`<g id="GLUE_SIDE">${glueSideParts.join("\n")}</g>`);
	parts.push(`<g id="GLUE_SHAPE">${glueShapeParts.join("\n")}</g>`);
	parts.push(`<g id="SHAPE">${shapeParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SIDE">${foldSideParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SHAPE">${foldShapeParts.join("\n")}</g>`);
	parts.push(`<g id="CUT_LINES"></g>`);
	parts.push(`<g id="DESIGN"></g>`);
	parts.push(`<g id="INFO">${info}</g>`);

	// no glue tabs

	const svg = `<?xml version="1.0" encoding="UTF-8"?>\n` +
		`<svg xmlns="http://www.w3.org/2000/svg" width="${contentWidth}${unit}" height="${contentHeight}${unit}" viewBox="0 0 ${contentWidth} ${contentHeight}">\n` +
		`<rect x="0" y="0" width="100%" height="100%" fill="white" id="BG"/>\n` +
		parts.join("\n") +
		`\n</svg>\n`;

	const meta = { faces: net.metrics.faces, perimeter: net.metrics.perimeter, area: net.metrics.area };
	return { svg, meta };
}

export { renderNetSvg };
