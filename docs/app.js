const A4 = { width: 210, height: 297, unit: 'mm' };
const strokeWidth = 0.6;
const dash = '2,1';

// Helpers
const q = sel => document.querySelector(sel);
const makeSvg = (w = A4.width, h = A4.height) =>
	`<svg xmlns="http://www.w3.org/2000/svg" width="${w}${A4.unit}" height="${h}${A4.unit}" viewBox="0 0 ${w} ${h}">
    <rect x="0" y="0" width="100%" height="100%" fill="white" id="BG"/>
    <g id="GLUE"></g>
    <g id="SHAPE"></g>
    <g id="FOLDING_LINES"></g>
    <g id="DESIGN"></g>
  </svg>`;

function parseFirstShape(svgText) {
	// Browser DOMParser
	const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
	const root = doc.documentElement;

	// Find first of: circle, ellipse, rect, path (in that order)
	const pick = sel => root.querySelector(sel);
	let el = pick('circle, ellipse, rect, path, polygon, polyline');
	if (!el) throw new Error('No supported shape found');

	const kind = el.tagName.toLowerCase();
	const info = { kind, node: el };

	if (kind === 'circle') {
		info.params = {
			cx: parseFloat(el.getAttribute('cx') || '0'),
			cy: parseFloat(el.getAttribute('cy') || '0'),
			r: parseFloat(el.getAttribute('r') || '0'),
		};
	} else if (kind === 'ellipse') {
		info.params = {
			cx: parseFloat(el.getAttribute('cx') || '0'),
			cy: parseFloat(el.getAttribute('cy') || '0'),
			rx: parseFloat(el.getAttribute('rx') || '0'),
			ry: parseFloat(el.getAttribute('ry') || '0'),
		};
	} else if (kind === 'rect') {
		info.params = {
			x: parseFloat(el.getAttribute('x') || '0'),
			y: parseFloat(el.getAttribute('y') || '0'),
			width: parseFloat(el.getAttribute('width') || '0'),
			height: parseFloat(el.getAttribute('height') || '0'),
			rx: parseFloat(el.getAttribute('rx') || '0') || undefined,
			ry: parseFloat(el.getAttribute('ry') || '0') || undefined,
		};
	} else {
		// path/polygon/polyline → we’ll grab d
		if (kind === 'path') {
			info.d = el.getAttribute('d') || '';
		} else {
			// quick convert polygon/polyline to d
			const pts = (el.getAttribute('points') || '').trim();
			if (!pts) throw new Error('Empty polygon/polyline');
			const close = (kind === 'polygon') ? ' Z' : '';
			info.d = 'M ' + pts + close;
		}
	}
	return info;
}

function circumference(info) {
	if (info.kind === 'circle') {
		const { r } = info.params;
		return 2 * Math.PI * r;
	}
	if (info.kind === 'ellipse') {
		const { rx, ry } = info.params;
		// Ramanujan II approximation for ellipse perimeter
		const h = Math.pow(rx - ry, 2) / Math.pow(rx + ry, 2);
		return Math.PI * (rx + ry) * (1 + (3 * h) / (10 + Math.sqrt(4 - 3 * h))) * 2; // multiply-by-2 mistake fix: remove *2? No — Ramanujan II already ≈ π(a+b)[...] * 2? Actually: 2π * sqrt((a^2+b^2)/2) alt. Let's prefer Ramanujan I:
	}
	// For paths/polygons: use an offscreen path and getTotalLength
	const tempSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	const p = document.createElementNS(tempSvg.namespaceURI, 'path');
	p.setAttribute('d', info.d);
	tempSvg.appendChild(p);
	return p.getTotalLength();
}

// Build saw-tooth polygons along a vertical seam
function buildSawTooth(x, y, h, depth, pitch = 7) {
	const polys = [];
	const n = Math.max(1, Math.floor(h / pitch));
	const step = h / n;
	for (let i = 0; i < n; i++) {
		const y0 = y + i * step;
		const y1 = y0 + step;
		// triangle sticking outward on left edge
		polys.push(`M ${x},${y0} L ${x - depth},${(y0 + y1) / 2} L ${x},${y1} Z`);
		// triangle on right edge
		polys.push(`M ${x + 50},${y0} L ${x + 50 + depth},${(y0 + y1) / 2} L ${x + 50},${y1} Z`);
	}
	return polys;
}

function buildTabsForRect(rect, type, tabW = 7) {
	const { x, y, w, h } = rect;
	const glue = [];
	const folds = [];

	// Vertical seams: saw-tooth for arcs, 45° for lines
	if (type === 'arc') {
		// Saw teeth along left/right; use tabW as tooth depth and pitch
		const polys = buildSawTooth(x, y, h, tabW, tabW);
		for (const d of polys) glue.push({ d, kind: 'path' });
		// fold lines along seams
		folds.push({ d: `M ${x},${y} L ${x},${y + h}` });
		folds.push({ d: `M ${x + 50},${y} L ${x + 50},${y + h}` });
	} else {
		// 45° trapezoids around each side
		glue.push({ d: `M ${x},${y} L ${x - tabW},${y + tabW} L ${x - tabW},${y + h - tabW} L ${x},${y + h} Z`, kind: 'path' });
		glue.push({ d: `M ${x + 50},${y} L ${x + 50 + tabW},${y + tabW} L ${x + 50 + tabW},${y + h - tabW} L ${x + 50},${y + h} Z`, kind: 'path' });
		glue.push({ d: `M ${x},${y} L ${x + 50},${y} L ${x + 50 - tabW},${y - tabW} L ${x + tabW},${y - tabW} Z`, kind: 'path' });
		glue.push({ d: `M ${x},${y + h} L ${x + 50},${y + h} L ${x + 50 - tabW},${y + h + tabW} L ${x + tabW},${y + h + tabW} Z`, kind: 'path' });
		folds.push({ d: `M ${x},${y} L ${x},${y + h}` });
		folds.push({ d: `M ${x + 50},${y} L ${x + 50},${y + h}` });
		folds.push({ d: `M ${x},${y} L ${x + 50},${y}` });
		folds.push({ d: `M ${x},${y + h} L ${x + 50},${y + h}` });
	}
	return { glue, folds };
}

function render({ info, depth, perim }) {
	// Build SVG skeleton
	const host = document.createElement('div');
	host.innerHTML = makeSvg();
	const svg = host.firstElementChild;
	const gGLUE = svg.getElementById('GLUE');
	const gSHAPE = svg.getElementById('SHAPE');
	const gFOLD = svg.getElementById('FOLDING_LINES');
	const gDESIGN = svg.getElementById('DESIGN');

	// Place stack rects in the middle; for this demo we use a single side-rect with height = perimeter
	// You can extend to multiple rects per edge later.
	const margin = 10;
	const stackX = 80; // fixed anchor
	const stackY = 20 + 50; // leave room for perimeter label
	const stack = [{ x: stackX, y: stackY, w: depth, h: perim, type: (info.kind === 'circle' || info.kind === 'ellipse') ? 'arc' : 'line' }];

	// Draw side-rectangles
	for (const r of stack) {
		const rect = document.createElementNS(svg.namespaceURI, 'rect');
		rect.setAttribute('x', r.x);
		rect.setAttribute('y', r.y);
		rect.setAttribute('width', r.w);
		rect.setAttribute('height', r.h);
		rect.setAttribute('fill', 'white');
		rect.setAttribute('stroke', '#000');
		rect.setAttribute('stroke-width', strokeWidth);
		gSHAPE.appendChild(rect);

		// Tabs
		const { glue, folds } = buildTabsForRect({ x: r.x, y: r.y, w: r.w, h: r.h }, r.type, 7);
		for (const g of glue) {
			const p = document.createElementNS(svg.namespaceURI, 'path');
			p.setAttribute('d', g.d);
			p.setAttribute('fill', '#e5e5e5');
			gGLUE.appendChild(p);
		}
		for (const f of folds) {
			const p = document.createElementNS(svg.namespaceURI, 'path');
			p.setAttribute('d', f.d);
			p.setAttribute('fill', 'none');
			p.setAttribute('stroke', '#FFF');
			p.setAttribute('stroke-width', 0.4);
			p.setAttribute('stroke-dasharray', dash);
			gFOLD.appendChild(p);
		}
	}

	// Place base (left of stack) and mirror (right of stack)
	const baseXRight = stackX; // tangent point on right of base
	const mirrorXLeft = stackX + depth; // tangent left of mirror
	const midY = stackY + perim / 2;

	if (info.kind === 'circle') {
		const { r } = info.params;
		// base (gray)
		const c1 = document.createElementNS(svg.namespaceURI, 'circle');
		c1.setAttribute('cx', baseXRight - r);
		c1.setAttribute('cy', midY);
		c1.setAttribute('r', r);
		c1.setAttribute('fill', '#e5e5e5');
		c1.setAttribute('stroke', '#000');
		c1.setAttribute('stroke-width', strokeWidth);
		gSHAPE.appendChild(c1);
		// mirror (white)
		const c2 = document.createElementNS(svg.namespaceURI, 'circle');
		c2.setAttribute('cx', mirrorXLeft + r);
		c2.setAttribute('cy', midY);
		c2.setAttribute('r', r);
		c2.setAttribute('fill', 'white');
		c2.setAttribute('stroke', '#000');
		c2.setAttribute('stroke-width', strokeWidth);
		gSHAPE.appendChild(c2);
	} else if (info.kind === 'ellipse') {
		const { rx, ry } = info.params;
		const e1 = document.createElementNS(svg.namespaceURI, 'ellipse');
		e1.setAttribute('cx', baseXRight - rx);
		e1.setAttribute('cy', midY);
		e1.setAttribute('rx', rx);
		e1.setAttribute('ry', ry);
		e1.setAttribute('fill', '#e5e5e5');
		e1.setAttribute('stroke', '#000');
		e1.setAttribute('stroke-width', strokeWidth);
		gSHAPE.appendChild(e1);

		const e2 = document.createElementNS(svg.namespaceURI, 'ellipse');
		e2.setAttribute('cx', mirrorXLeft + rx);
		e2.setAttribute('cy', midY);
		e2.setAttribute('rx', rx);
		e2.setAttribute('ry', ry);
		e2.setAttribute('fill', 'white');
		e2.setAttribute('stroke', '#000');
		e2.setAttribute('stroke-width', strokeWidth);
		gSHAPE.appendChild(e2);
	} else {
		// Generic path (render original path d): base left (gray), mirror right (white)
		const base = document.createElementNS(svg.namespaceURI, 'path');
		base.setAttribute('d', info.d);
		base.setAttribute('fill', '#e5e5e5');
		base.setAttribute('stroke', '#000');
		base.setAttribute('stroke-width', strokeWidth);
		// Align by bbox’s maxX to stackX (simple approach)
		const bb = pathBBox(info.d);
		const txBase = baseXRight - bb.maxX;
		const tyBase = midY - (bb.y + bb.height / 2);
		base.setAttribute('transform', `translate(${txBase},${tyBase})`);
		gSHAPE.appendChild(base);

		const mir = document.createElementNS(svg.namespaceURI, 'path');
		mir.setAttribute('d', info.d);
		mir.setAttribute('fill', 'white');
		mir.setAttribute('stroke', '#000');
		mir.setAttribute('stroke-width', strokeWidth);
		// Mirror horizontally around its center, then place tangent-left = mirrorXLeft
		const bb2 = pathBBox(info.d);
		const cx = bb2.x + bb2.width / 2, cy = bb2.y + bb2.height / 2;
		const txMir = mirrorXLeft - (2 * cx - bb2.minX); // approximate: after scale(-1) around center, minX’ becomes 2*cx - maxX, but we’ll adjust by full matrix:
		mir.setAttribute('transform', `translate(${cx},${cy}) scale(-1,1) translate(${-cx},${-cy}) translate(${mirrorXLeft - (bb2.minX - (bb2.maxX - mirrorXLeft))},${midY - (bb2.y + bb2.height / 2)})`);
		gSHAPE.appendChild(mir);
	}

	// Perimeter label
	const text = document.createElementNS(svg.namespaceURI, 'text');
	text.setAttribute('x', 5);
	text.setAttribute('y', 10);
	text.setAttribute('font-family', 'Arial, Helvetica, sans-serif');
	text.setAttribute('font-size', 6);
	text.setAttribute('fill', '#000');
	text.textContent = `Perimeter: ${perim.toFixed(2)} mm`;
	gDESIGN.appendChild(text);

	return svg;
}

// Rough bbox for a path using an SVG path element on the fly
function pathBBox(d) {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	const p = document.createElementNS(svg.namespaceURI, 'path');
	p.setAttribute('d', d);
	svg.appendChild(p);
	const bb = p.getBBox();
	return { x: bb.x, y: bb.y, width: bb.width, height: bb.height, minX: bb.x, maxX: bb.x + bb.width };
}

// Wire UI
q('#generate').addEventListener('click', async () => {
	const file = q('#file').files[0];
	if (!file) { alert('Pick an SVG file.'); return; }
	const depth = parseFloat(q('#depth').value || '40');
	const text = await file.text();

	let info;
	try { info = parseFirstShape(text); }
	catch (e) { alert(e.message); return; }

	// Compute perimeter/circumference
	let perim = 0;
	if (info.kind === 'ellipse') {
		const { rx, ry } = info.params;
		// Ramanujan I: π[3(a+b) − √((3a+b)(a+3b))]
		const a = rx, b = ry;
		perim = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
	} else {
		perim = circumference(info);
	}

	const svg = render({ info, depth, perim });
	const preview = q('#preview');
	preview.innerHTML = '';
	preview.appendChild(svg);

	// Enable download
	q('#download').disabled = false;
	q('#download').onclick = () => {
		const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'net.svg';
		document.body.appendChild(a);
		a.click();
		URL.revokeObjectURL(url);
		a.remove();
	};
});
