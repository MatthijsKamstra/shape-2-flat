"use strict";
import { calculateArcCenter, fitCurveCircle } from './geometry.mjs';

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

function renderNetSvg(net, { margin = 10, unit = "px", page, originalShape, scale = 1, debug = true } = {}) {
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
		const r = {
			x: sx,
			y: cy,
			w: seg.w,
			h: seg.h,
			type: seg.type || 'line',
			arcParams: seg.arcParams,
			x1: seg.x1,
			y1: seg.y1,
			x2: seg.x2,
			y2: seg.y2,
			cx1: seg.cx1,
			cy1: seg.cy1,
			cx2: seg.cx2,
			cy2: seg.cy2,
			isQuadratic: seg.isQuadratic
		};
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
	const stackedC = stacked.map(r => ({
		x: r.x + dx,
		y: r.y + dy,
		w: r.w,
		h: r.h,
		type: r.type,
		arcParams: r.arcParams,
		x1: r.x1,
		y1: r.y1,
		x2: r.x2,
		y2: r.y2,
		cx1: r.cx1,
		cy1: r.cy1,
		cx2: r.cx2,
		cy2: r.cy2,
		isQuadratic: r.isQuadratic
	}));
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
	} else if (useRect && originalShape.shapeParams) {
		// Render as axis-aligned rects using the rotated polygon bbox
		const bBox = bboxOfPoints(baseC);
		const mBox = bboxOfPoints(mirrorC);
		const bw = bBox.maxX - bBox.minX;
		const bh = bBox.maxY - bBox.minY;
		const mw = mBox.maxX - mBox.minX;
		const mh = mBox.maxY - mBox.minY;
		shapeParts.push(`<rect x="${bBox.minX}" y="${bBox.minY}" width="${bw}" height="${bh}" ${baseStyle}/>`);
		shapeParts.push(`<rect x="${mBox.minX}" y="${mBox.minY}" width="${mw}" height="${mh}" ${mirrorStyle}/>`);
	} else if (originalShape && (originalShape.kind === 'path' || originalShape.kind === 'polygon' || originalShape.kind === 'polyline') && originalShape.d && net.rotation) {
		// Preserve original path/polygon/polyline with transforms
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
		// Fallback: render as path from polygon points
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

	// Add glue tabs and fold lines for base and mirror shapes
	// Base shape tabs (on perimeter edges that don't touch the side stack)
	const stackLeft = stackedC[0].x;
	const stackRight = stackedC[0].x + stackedC[0].w;

	// Helper function to add tabs along a polygon edge
	function addShapeEdgeTabs(points, isBase, segmentTypes = []) {
		for (let i = 0; i < points.length; i++) {
			const [x1, y1] = points[i];
			const [x2, y2] = points[(i + 1) % points.length];
			const segType = segmentTypes[i] || 'line';

			// Calculate edge direction and normal
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.hypot(dx, dy);
			if (len < 1e-6) continue;

			// For arc/curve edges, skip - they're handled separately with proper arc center calculation
			if (segType === 'arc' || segType === 'curve') {
				continue;
			} else {
				// Straight edge: use trapezoid tabs
				// Unit tangent and normal (outward)
				const tx = dx / len;
				const ty = dy / len;
				const nx = -ty;
				const ny = tx;

				// Add fold line along the edge
				foldShapeParts.push(`<path d="M ${x1},${y1} L ${x2},${y2}" ${foldStyle}/>`);

				// Taper distance from edge endpoints (for trapezoid shape)
				const taper = Math.min(tabW, len / 2);

				// Create tabs on both sides of the edge, perpendicular to the edge direction
				// Tab extends perpendicular using normal vector (nx, ny)

				// Tab 1: extends in positive normal direction
				const d1 = `M ${x1},${y1} L ${x1 + tx * taper + nx * tabW},${y1 + ty * taper + ny * tabW} L ${x2 - tx * taper + nx * tabW},${y2 - ty * taper + ny * tabW} L ${x2},${y2} Z`;
				glueShapeParts.push(`<path d="${d1}" ${tabStyle}/>`);

				// Tab 2: extends in negative normal direction
				const d2 = `M ${x1},${y1} L ${x1 + tx * taper - nx * tabW},${y1 + ty * taper - ny * tabW} L ${x2 - tx * taper - nx * tabW},${y2 - ty * taper - ny * tabW} L ${x2},${y2} Z`;
				glueShapeParts.push(`<path d="${d2}" ${tabStyle}/>`);
			}
		}
	}

	// Helper function to add star-pattern tabs around circle/ellipse
	function addCircleStarTabs(cx, cy, rx, ry) {
		// Calculate number of spikes based on perimeter (approximately one spike per 8-10mm)
		const perimeter = Math.PI * (3 * (rx + ry) - Math.sqrt((3 * rx + ry) * (rx + 3 * ry)));
		const numSpikes = Math.max(12, Math.min(48, Math.round(perimeter / 8)));

		// Create a single star-shaped path alternating between inner and outer radii
		// Inner radius = rx/ry (on perimeter), outer radius = rx/ry + tabW (extended)
		const pathParts = [];
		const foldParts = [];

		for (let i = 0; i < numSpikes * 2; i++) {
			const angle = (i * Math.PI) / numSpikes;
			const isOuter = i % 2 === 1;

			let x, y;
			if (isOuter) {
				// Outer point (spike tip)
				x = cx + (rx + tabW) * Math.cos(angle);
				y = cy + (ry + tabW) * Math.sin(angle);
			} else {
				// Inner point (on perimeter)
				x = cx + rx * Math.cos(angle);
				y = cy + ry * Math.sin(angle);
			}

			if (i === 0) {
				pathParts.push(`M ${x},${y}`);
			} else {
				pathParts.push(`L ${x},${y}`);
			}

			// Add fold lines along the inner (perimeter) edges only
			if (!isOuter && i > 0) {
				const prevAngle = ((i - 2) * Math.PI) / numSpikes;
				const x1 = cx + rx * Math.cos(prevAngle);
				const y1 = cy + ry * Math.sin(prevAngle);
				foldParts.push(`<path d="M ${x1},${y1} L ${x},${y}" ${foldStyle}/>`);
			}
		}

		pathParts.push('Z');
		glueShapeParts.push(`<path d="${pathParts.join(' ')}" ${tabStyle}/>`);
		foldShapeParts.push(...foldParts);
	}

	// Add tabs for base and mirror
	if (useCircle || useEllipse) {
		// Star-pattern tabs for circles and ellipses
		const stackLeftX = stackedC[0].x;
		const stackRightX = stackedC[0].x + stackedC[0].w;
		const stackTopY = stackedC[0].y;
		const stackMidY = stackTopY + (stackedC.reduce((s, r) => s + r.h, 0)) / 2;

		if (useCircle) {
			const { r } = originalShape.shapeParams;
			const baseCx = stackLeftX - r;
			const mirrCx = stackRightX + r;
			addCircleStarTabs(baseCx, stackMidY, r, r);
			addCircleStarTabs(mirrCx, stackMidY, r, r);
		} else {
			const { rx, ry } = originalShape.shapeParams;
			const baseCx = stackLeftX - rx;
			const mirrCx = stackRightX + rx;
			addCircleStarTabs(baseCx, stackMidY, rx, ry);
			addCircleStarTabs(mirrCx, stackMidY, rx, ry);
		}
	} else {
		// Polygon edge tabs for non-circular shapes
		// Only use polygon-based tabs if the shape doesn't have arcs
		// (arcs are handled separately with proper arc center calculation)
		const hasArcs = stackedC.some(r => r.type === 'arc' || r.type === 'curve');

		if (!hasArcs) {
			const segmentTypes = stackedC.map(r => r.type || 'line');
			addShapeEdgeTabs(baseC, true, segmentTypes);
			addShapeEdgeTabs(mirrorC, false, segmentTypes);
		}
		// For shapes with arcs, tabs are generated by the arc handling code below
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

	// Generate star-pattern glue tabs for arc/curve segments (debug optional)
	const debugParts = debug ? [] : null;

	// Helper function to generate star pattern tabs at a specific position
	function addArcStarTabs(cx, cy, rx, ry, numSpikes) {
		// Create a single star-shaped path alternating between inner and outer radii
		// Inner radius = rx/ry (on perimeter), outer radius = rx/ry + tabW (extended)
		const pathParts = [];
		const foldParts = [];

		for (let i = 0; i < numSpikes * 2; i++) {
			const angle = (i * Math.PI) / numSpikes;
			const isOuter = i % 2 === 1;

			let x, y;
			if (isOuter) {
				// Outer point (spike tip)
				x = cx + (rx + tabW) * Math.cos(angle);
				y = cy + (ry + tabW) * Math.sin(angle);
			} else {
				// Inner point (on perimeter)
				x = cx + rx * Math.cos(angle);
				y = cy + ry * Math.sin(angle);
			}

			if (i === 0) {
				pathParts.push(`M ${x},${y}`);
			} else {
				pathParts.push(`L ${x},${y}`);
			}

			// Add fold lines along the inner (perimeter) edges only
			if (!isOuter && i > 0) {
				const prevAngle = ((i - 2) * Math.PI) / numSpikes;
				const x1 = cx + rx * Math.cos(prevAngle);
				const y1 = cy + ry * Math.sin(prevAngle);
				foldParts.push(`<path d="M ${x1},${y1} L ${x},${y}" ${foldStyle}/>`);
			}
		}

		pathParts.push('Z');
		glueShapeParts.push(`<path d="${pathParts.join(' ')}" ${tabStyle}/>`);
		foldShapeParts.push(...foldParts);
	}

	if (originalShape && originalShape.d && net.rotation) {
		// For path-based shapes, apply the same transforms as the rendered shapes
		const deg = (net.rotation.angle * 180) / Math.PI;
		const rotation = net.rotation.angle;
		const c0x = net.rotation.centroidOriginal[0] * scale;
		const c0y = net.rotation.centroidOriginal[1] * scale;
		const cBx = net.rotation.centroidBase[0];
		const cBy = net.rotation.centroidBase[1];
		const stackLeftX0 = sx;
		const stackRightX0 = sx + (stacked[0]?.w || 0);
		const deltaBaseX = stackLeftX0 - baseBox.maxX;
		const deltaMirrorX = stackRightX0 - mirrorBox.minX;
		const cosR = Math.cos(rotation);
		const sinR = Math.sin(rotation);

		for (const seg of stackedC) {
			if ((seg.type === 'arc' || seg.type === 'curve') && seg.arcParams) {
				const { x1, y1, x2, y2, rx, ry, xRot, largeArc, sweep } = seg.arcParams;

				// Calculate actual arc center in original coordinates
				const { cx: cx0, cy: cy0 } = calculateArcCenter(x1, y1, x2, y2, rx, ry, xRot || 0, largeArc || 0, sweep || 0);

				// Transform for BASE shape
				let bx = cx0;
				let by = cy0;

				bx *= scale;
				by *= scale;

				let dbx = bx - c0x;
				let dby = by - c0y;
				bx = c0x + dbx * cosR - dby * sinR;
				by = c0y + dbx * sinR + dby * cosR;

				bx += dx + baseOffsetX + deltaBaseX;
				by += dy + baseOffsetY;

				const baseRx = rx * scale;
				const baseRy = ry * scale;

				// Calculate number of spikes based on arc perimeter (same as circle)
				const arcPerimeter = Math.PI * (3 * (baseRx + baseRy) - Math.sqrt((3 * baseRx + baseRy) * (baseRx + 3 * baseRy)));
				const numSpikes = Math.max(12, Math.min(48, Math.round(arcPerimeter / 8)));

				// Generate star tabs for base
				addArcStarTabs(bx, by, baseRx, baseRy, numSpikes);

				// Debug circles (optional)
				if (debugParts) {
					const avgR = (baseRx + baseRy) / 2;
					debugParts.push(`<circle cx="${bx}" cy="${by}" r="${avgR}" fill="none" stroke="red" stroke-width="0.5" stroke-dasharray="2,1"/>`);
					debugParts.push(`<circle cx="${bx}" cy="${by}" r="1" fill="red"/>`);
					debugParts.push(`<ellipse cx="${bx}" cy="${by}" rx="${baseRx}" ry="${baseRy}" fill="none" stroke="orange" stroke-width="0.3" stroke-dasharray="1,1"/>`);
				}


				// Transform for MIRROR shape
				let mx = cx0;
				let my = cy0;

				mx *= scale;
				my *= scale;

				let dmx = mx - c0x;
				let dmy = my - c0y;
				mx = c0x + dmx * cosR - dmy * sinR;
				my = c0y + dmx * sinR + dmy * cosR;

				mx -= cBx;
				my -= cBy;

				mx = -mx;

				mx += cBx;
				my += cBy;

				mx += mirrorOffsetX + deltaMirrorX;
				my += mirrorOffsetY;

				mx += dx;
				my += dy;

				// Generate star tabs for mirror
				addArcStarTabs(mx, my, baseRx, baseRy, numSpikes);

				// Debug mirror
				if (debugParts) {
					const avgR = (baseRx + baseRy) / 2;
					debugParts.push(`<circle cx="${mx}" cy="${my}" r="${avgR}" fill="none" stroke="blue" stroke-width="0.5" stroke-dasharray="2,1"/>`);
					debugParts.push(`<circle cx="${mx}" cy="${my}" r="1" fill="blue"/>`);
					debugParts.push(`<ellipse cx="${mx}" cy="${my}" rx="${baseRx}" ry="${baseRy}" fill="none" stroke="cyan" stroke-width="0.3" stroke-dasharray="1,1"/>`);
				}
			}

			// Handle CURVE segments using geometry helper fitCurveCircle
			if (seg.type === 'curve' && seg.x1 !== undefined) {
				const fit = fitCurveCircle(seg);
				if (!fit) continue;
				let { cx: cx0, cy: cy0, r: r0 } = fit;

				// Transform for BASE shape
				let bx = cx0 * scale;
				let by = cy0 * scale;

				let dbx = bx - c0x;
				let dby = by - c0y;
				bx = c0x + dbx * cosR - dby * sinR;
				by = c0y + dbx * sinR + dby * cosR;

				bx += dx + baseOffsetX + deltaBaseX;
				by += dy + baseOffsetY;

				const baseR = r0 * scale;

				// Calculate number of spikes based on perimeter
				const curvePerimeter = 2 * Math.PI * baseR;
				const numSpikes = Math.max(12, Math.min(48, Math.round(curvePerimeter / 8)));

				// Generate star tabs for base
				addArcStarTabs(bx, by, baseR, baseR, numSpikes);

				if (debugParts) {
					debugParts.push(`<circle cx="${bx}" cy="${by}" r="${baseR}" fill="none" stroke="red" stroke-width="0.5" stroke-dasharray="2,1"/>`);
					debugParts.push(`<circle cx="${bx}" cy="${by}" r="1" fill="red"/>`);
				}

				// Transform for MIRROR shape
				let mx = cx0 * scale;
				let my = cy0 * scale;

				let dmx = mx - c0x;
				let dmy = my - c0y;
				mx = c0x + dmx * cosR - dmy * sinR;
				my = c0y + dmx * sinR + dmy * cosR;

				mx -= cBx;
				my -= cBy;
				mx = -mx;
				mx += cBx;
				my += cBy;

				mx += mirrorOffsetX + deltaMirrorX + dx;
				my += mirrorOffsetY + dy;

				// Generate star tabs for mirror
				addArcStarTabs(mx, my, baseR, baseR, numSpikes);

				if (debugParts) {
					debugParts.push(`<circle cx="${mx}" cy="${my}" r="${baseR}" fill="none" stroke="blue" stroke-width="0.5" stroke-dasharray="2,1"/>`);
					debugParts.push(`<circle cx="${mx}" cy="${my}" r="1" fill="blue"/>`);
				}
			}
		}

		// Generate tabs for straight line segments only when shape has arcs/curves (polygon path skipped)
		if (originalShape?.hasArcs) {
			for (const seg of stackedC) {
				if (seg.type !== 'line' || !seg.x1) continue;

				// BASE shape - transform and generate tabs
				let bx1 = seg.x1 * scale;
				let by1 = seg.y1 * scale;
				let bx2 = seg.x2 * scale;
				let by2 = seg.y2 * scale;

				// Apply rotation
				let d1x = bx1 - c0x, d1y = by1 - c0y;
				bx1 = c0x + d1x * cosR - d1y * sinR;
				by1 = c0y + d1x * sinR + d1y * cosR;

				let d2x = bx2 - c0x, d2y = by2 - c0y;
				bx2 = c0x + d2x * cosR - d2y * sinR;
				by2 = c0y + d2x * sinR + d2y * cosR;

				// Apply translation
				bx1 += dx + baseOffsetX + deltaBaseX;
				by1 += dy + baseOffsetY;
				bx2 += dx + baseOffsetX + deltaBaseX;
				by2 += dy + baseOffsetY;

				// Generate trapezoid tabs
				const edgeVx = bx2 - bx1;
				const edgeVy = by2 - by1;
				const edgeLen = Math.sqrt(edgeVx * edgeVx + edgeVy * edgeVy);
				if (edgeLen < 1e-6) continue;

				const edgeTx = edgeVx / edgeLen;
				const edgeTy = edgeVy / edgeLen;
				const edgeNx = -edgeTy;
				const edgeNy = edgeTx;
				const taper = Math.min(tabW, edgeLen / 2);

				// Tab 1: positive normal direction
				const d1 = `M ${bx1},${by1} L ${bx1 + edgeTx * taper + edgeNx * tabW},${by1 + edgeTy * taper + edgeNy * tabW} L ${bx2 - edgeTx * taper + edgeNx * tabW},${by2 - edgeTy * taper + edgeNy * tabW} L ${bx2},${by2} Z`;
				glueShapeParts.push(`<path d="${d1}" ${tabStyle}/>`);
				foldShapeParts.push(`<path d="M ${bx1},${by1} L ${bx2},${by2}" ${foldStyle}/>`);

				// Tab 2: negative normal direction
				const d2 = `M ${bx1},${by1} L ${bx1 + edgeTx * taper - edgeNx * tabW},${by1 + edgeTy * taper - edgeNy * tabW} L ${bx2 - edgeTx * taper - edgeNx * tabW},${by2 - edgeTy * taper - edgeNy * tabW} L ${bx2},${by2} Z`;
				glueShapeParts.push(`<path d="${d2}" ${tabStyle}/>`);

				// MIRROR shape - transform and generate tabs
				let mx1 = seg.x1 * scale;
				let my1 = seg.y1 * scale;
				let mx2 = seg.x2 * scale;
				let my2 = seg.y2 * scale;

				// Apply rotation
				let dm1x = mx1 - c0x, dm1y = my1 - c0y;
				mx1 = c0x + dm1x * cosR - dm1y * sinR;
				my1 = c0y + dm1x * sinR + dm1y * cosR;

				let dm2x = mx2 - c0x, dm2y = my2 - c0y;
				mx2 = c0x + dm2x * cosR - dm2y * sinR;
				my2 = c0y + dm2x * sinR + dm2y * cosR;

				// Apply mirror transform
				mx1 -= cBx; my1 -= cBy;
				mx2 -= cBx; my2 -= cBy;
				mx1 = -mx1;
				mx2 = -mx2;
				mx1 += cBx; my1 += cBy;
				mx2 += cBx; my2 += cBy;

				// Apply translation
				mx1 += mirrorOffsetX + deltaMirrorX + dx;
				my1 += mirrorOffsetY + dy;
				mx2 += mirrorOffsetX + deltaMirrorX + dx;
				my2 += mirrorOffsetY + dy;

				// Generate trapezoid tabs for mirror
				const mEdgeVx = mx2 - mx1;
				const mEdgeVy = my2 - my1;
				const mEdgeLen = Math.sqrt(mEdgeVx * mEdgeVx + mEdgeVy * mEdgeVy);
				if (mEdgeLen < 1e-6) continue;

				const mEdgeTx = mEdgeVx / mEdgeLen;
				const mEdgeTy = mEdgeVy / mEdgeLen;
				const mEdgeNx = -mEdgeTy;
				const mEdgeNy = mEdgeTx;
				const mTaper = Math.min(tabW, mEdgeLen / 2);

				// Tab 1: positive normal direction
				const md1 = `M ${mx1},${my1} L ${mx1 + mEdgeTx * mTaper + mEdgeNx * tabW},${my1 + mEdgeTy * mTaper + mEdgeNy * tabW} L ${mx2 - mEdgeTx * mTaper + mEdgeNx * tabW},${my2 - mEdgeTy * mTaper + mEdgeNy * tabW} L ${mx2},${my2} Z`;
				glueShapeParts.push(`<path d="${md1}" ${tabStyle}/>`);
				foldShapeParts.push(`<path d="M ${mx1},${my1} L ${mx2},${my2}" ${foldStyle}/>`);

				// Tab 2: negative normal direction
				const md2 = `M ${mx1},${my1} L ${mx1 + mEdgeTx * mTaper - mEdgeNx * tabW},${my1 + mEdgeTy * mTaper - mEdgeNy * tabW} L ${mx2 - mEdgeTx * mTaper - mEdgeNx * tabW},${my2 - mEdgeTy * mTaper - mEdgeNy * tabW} L ${mx2},${my2} Z`;
				glueShapeParts.push(`<path d="${md2}" ${tabStyle}/>`);
			}
		}
	} let parts = [];
	parts.push(`<g id="GLUE_SIDE">${glueSideParts.join("\n")}</g>`);
	parts.push(`<g id="GLUE_SHAPE">${glueShapeParts.join("\n")}</g>`);
	parts.push(`<g id="SHAPE">${shapeParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SIDE">${foldSideParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SHAPE">${foldShapeParts.join("\n")}</g>`);
	parts.push(`<g id="CUT_LINES"></g>`);
	parts.push(`<g id="DESIGN"></g>`);
	parts.push(`<g id="DEBUG">${debugParts ? debugParts.join("\n") : ''}</g>`);
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
