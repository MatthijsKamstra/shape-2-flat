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
		const r = { x: sx, y: cy, w: seg.w, h: seg.h, type: seg.type || 'line', arcParams: seg.arcParams };
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
	const stackedC = stacked.map(r => ({ x: r.x + dx, y: r.y + dy, w: r.w, h: r.h, type: r.type, arcParams: r.arcParams }));
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

			// For arc/curve edges, use star pattern similar to circles
			if (segType === 'arc' || segType === 'curve') {
				// Calculate number of spikes based on arc length
				const numSpikes = Math.max(4, Math.min(16, Math.round(len / 8)));

				// Unit tangent and normal (outward)
				const tx = dx / len;
				const ty = dy / len;
				const nx = -ty;
				const ny = tx;

				// Create star pattern along the edge - alternating inner and outer points
				const pathParts = [];
				const foldParts = [];

				for (let j = 0; j < numSpikes * 2; j++) {
					const t = j / (numSpikes * 2);
					const isOuter = j % 2 === 1;

					// Point along the edge (linear interpolation)
					const edgeX = x1 + dx * t;
					const edgeY = y1 + dy * t;

					let x, y;
					if (isOuter) {
						// Outer point (spike tip) - extend perpendicular by tabW
						x = edgeX + nx * tabW;
						y = edgeY + ny * tabW;
					} else {
						// Inner point (on edge)
						x = edgeX;
						y = edgeY;
					}

					if (j === 0) {
						pathParts.push(`M ${x},${y}`);
					} else {
						pathParts.push(`L ${x},${y}`);
					}

					// Add fold lines between inner (perimeter) points only
					if (!isOuter && j > 0) {
						const prevT = (j - 2) / (numSpikes * 2);
						const prevX = x1 + dx * prevT;
						const prevY = y1 + dy * prevT;
						foldParts.push(`<path d="M ${prevX},${prevY} L ${x},${y}" ${foldStyle}/>`);
					}
				}

				pathParts.push('Z');
				glueShapeParts.push(`<path d="${pathParts.join(' ')}" ${tabStyle}/>`);
				foldShapeParts.push(...foldParts);

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
		// Check if shape has arc/curve segments
		const hasArcs = stackedC.some(r => r.type === 'arc' || r.type === 'curve');
		
		if (!hasArcs) {
			// Only generate tabs for shapes without arcs
			const segmentTypes = stackedC.map(r => r.type || 'line');
			addShapeEdgeTabs(baseC, true, segmentTypes);
			addShapeEdgeTabs(mirrorC, false, segmentTypes);
		}
		// Skip tab generation for shapes with arcs (tabs are wrong for now)
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

	// Helper function to calculate arc center from SVG arc parameters
	function calculateArcCenter(x1, y1, x2, y2, rx, ry, xRot, largeArc, sweep) {
		// Convert rotation angle to radians
		const phi = (xRot * Math.PI) / 180;
		const cosPhi = Math.cos(phi);
		const sinPhi = Math.sin(phi);

		// Compute half-distance between endpoints
		const dx = (x1 - x2) / 2;
		const dy = (y1 - y2) / 2;

		// Rotate to align with ellipse axes
		const x1Prime = cosPhi * dx + sinPhi * dy;
		const y1Prime = -sinPhi * dx + cosPhi * dy;

		// Correct radii if needed
		const lambda = (x1Prime * x1Prime) / (rx * rx) + (y1Prime * y1Prime) / (ry * ry);
		if (lambda > 1) {
			rx *= Math.sqrt(lambda);
			ry *= Math.sqrt(lambda);
		}

		// Calculate center in rotated coordinates
		const sign = largeArc !== sweep ? 1 : -1;
		const sq = Math.max(0, (rx * rx * ry * ry - rx * rx * y1Prime * y1Prime - ry * ry * x1Prime * x1Prime) / 
			(rx * rx * y1Prime * y1Prime + ry * ry * x1Prime * x1Prime));
		const coef = sign * Math.sqrt(sq);
		const cxPrime = coef * (rx * y1Prime) / ry;
		const cyPrime = -coef * (ry * x1Prime) / rx;

		// Rotate back and translate
		const cx = cosPhi * cxPrime - sinPhi * cyPrime + (x1 + x2) / 2;
		const cy = sinPhi * cxPrime + cosPhi * cyPrime + (y1 + y2) / 2;

		return { cx, cy };
	}

	// DEBUG: Create fitted circles for arc segments on base and mirror shapes
	const debugParts = [];
	
	// Apply transform to a point
	function transformPoint(x, y, sx, sy, rotation, cx, cy, translateX, translateY) {
		// Scale
		let tx = x * sx;
		let ty = y * sy;
		
		// Rotate around center
		const cosR = Math.cos(rotation);
		const sinR = Math.sin(rotation);
		const dx = tx - cx;
		const dy = ty - cy;
		tx = cx + dx * cosR - dy * sinR;
		ty = cy + dx * sinR + dy * cosR;
		
		// Translate
		tx += translateX;
		ty += translateY;
		
		return { x: tx, y: ty };
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
		
		for (const seg of stackedC) {
			if ((seg.type === 'arc' || seg.type === 'curve') && seg.arcParams) {
				const { x1, y1, x2, y2, rx, ry, xRot, largeArc, sweep } = seg.arcParams;
				
				// Calculate actual arc center in original coordinates
				const { cx: cx0, cy: cy0 } = calculateArcCenter(x1, y1, x2, y2, rx, ry, xRot || 0, largeArc || 0, sweep || 0);
				
				// Transform for BASE shape
				const baseTransX = dx + baseOffsetX + deltaBaseX;
				const baseTransY = dy + baseOffsetY;
				const basePt = transformPoint(cx0, cy0, scale, scale, rotation, c0x, c0y, baseTransX, baseTransY);
				const baseR = (rx + ry) / 2 * scale;
				
				debugParts.push(`<circle cx="${basePt.x}" cy="${basePt.y}" r="${baseR}" fill="none" stroke="red" stroke-width="0.5" stroke-dasharray="2,1"/>`);
				debugParts.push(`<circle cx="${basePt.x}" cy="${basePt.y}" r="1" fill="red"/>`);
				
				// Transform for MIRROR shape
				// SVG transforms apply right-to-left:
				// scale(1 1) → rotate(-270 c0x c0y) → translate(-cBx,-cBy) → scale(-1 1) → translate(cBx,cBy) → translate(mirror) → translate(dx,dy)
				
				let mx = cx0;
				let my = cy0;
				
				// 1. scale(1 1) - apply scale first
				mx *= scale;
				my *= scale;
				
				// 2. rotate around c0
				const cosR = Math.cos(rotation);
				const sinR = Math.sin(rotation);
				let dmx = mx - c0x;
				let dmy = my - c0y;
				mx = c0x + dmx * cosR - dmy * sinR;
				my = c0y + dmx * sinR + dmy * cosR;
				
				// 3. translate(-cBx, -cBy)
				mx -= cBx;
				my -= cBy;
				
				// 4. scale(-1, 1) - horizontal flip
				mx = -mx;
				
				// 5. translate(cBx, cBy)
				mx += cBx;
				my += cBy;
				
				// 6. translate(mirror offset)
				mx += mirrorOffsetX + deltaMirrorX;
				my += mirrorOffsetY;
				
				// 7. translate(dx, dy) - final centering
				mx += dx;
				my += dy;
				
				debugParts.push(`<circle cx="${mx}" cy="${my}" r="${baseR}" fill="none" stroke="blue" stroke-width="0.5" stroke-dasharray="2,1"/>`);
				debugParts.push(`<circle cx="${mx}" cy="${my}" r="1" fill="blue"/>`);
			}
		}
	}

	let parts = [];
	parts.push(`<g id="GLUE_SIDE">${glueSideParts.join("\n")}</g>`);
	parts.push(`<g id="GLUE_SHAPE">${glueShapeParts.join("\n")}</g>`);
	parts.push(`<g id="SHAPE">${shapeParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SIDE">${foldSideParts.join("\n")}</g>`);
	parts.push(`<g id="FOLDING_SHAPE">${foldShapeParts.join("\n")}</g>`);
	parts.push(`<g id="CUT_LINES"></g>`);
	parts.push(`<g id="DESIGN"></g>`);
	parts.push(`<g id="DEBUG">${debugParts.join("\n")}</g>`);
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
