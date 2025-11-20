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

function numberMatcher() {
	return /[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // sticky
}

function isCommand(ch) {
	return /[a-zA-Z]/.test(ch);
}

function readNumber(src, pos) {
	const re = numberMatcher();
	re.lastIndex = pos;
	const m = re.exec(src);
	if (!m) return { value: null, next: pos };
	return { value: parseFloat(m[0]), next: re.lastIndex };
}

function skipSeparators(src, pos) {
	while (pos < src.length) {
		const ch = src[pos];
		if (ch === ',' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') pos++;
		else break;
	}
	return pos;
}

// Returns an array of { type: 'line'|'arc'|'curve', length }
// Supports M/m, L/l, H/h, V/v, A/a, C/c, Q/q, S/s, T/t, Z/z
function computeSegmentLengthsFromPath(d) {
	if (!d) return null;
	const src = d;
	let pos = 0;
	let cmd = null;
	let curX = 0, curY = 0;
	let subX = 0, subY = 0;
	let lastControlX = null, lastControlY = null; // For smooth curves S/T
	let haveUnsupported = false;
	const segs = [];

	function arcLength(x0, y0, rx, ry, xRot, largeArc, sweep, x1, y1) {
		const piece = `M ${x0},${y0} A ${rx} ${ry} ${xRot} ${largeArc} ${sweep} ${x1} ${y1}`;
		try {
			if (svgPathPropertiesNode) {
				const props = new svgPathPropertiesNode(piece);
				return props.getTotalLength();
			}
			// Browser fallback: use SVGPathElement
			if (typeof document !== 'undefined') {
				const svgNS = 'http://www.w3.org/2000/svg';
				const svg = document.createElementNS(svgNS, 'svg');
				const path = document.createElementNS(svgNS, 'path');
				path.setAttribute('d', piece);
				svg.appendChild(path);
				return path.getTotalLength();
			}
			return Math.hypot(x1 - x0, y1 - y0);
		} catch {
			return Math.hypot(x1 - x0, y1 - y0);
		}
	}

	function curveLength(pathData) {
		try {
			if (svgPathPropertiesNode) {
				const props = new svgPathPropertiesNode(pathData);
				return props.getTotalLength();
			}
			// Browser fallback: use SVGPathElement
			if (typeof document !== 'undefined') {
				const svgNS = 'http://www.w3.org/2000/svg';
				const svg = document.createElementNS(svgNS, 'svg');
				const path = document.createElementNS(svgNS, 'path');
				path.setAttribute('d', pathData);
				svg.appendChild(path);
				return path.getTotalLength();
			}
			// Fallback: approximate with straight line
			const match = pathData.match(/M\s*([\d.+-]+)[,\s]+([\d.+-]+).*\s+([\d.+-]+)[,\s]+([\d.+-]+)$/);
			if (match) {
				const x0 = parseFloat(match[1]), y0 = parseFloat(match[2]);
				const x1 = parseFloat(match[3]), y1 = parseFloat(match[4]);
				return Math.hypot(x1 - x0, y1 - y0);
			}
			return 0;
		} catch {
			return 0;
		}
	}

	while (pos < src.length) {
		pos = skipSeparators(src, pos);
		const ch = src[pos];
		if (!ch) break;
		if (isCommand(ch)) { cmd = ch; pos++; }
		else if (cmd == null) { break; }

		const isRel = cmd >= 'a' && cmd <= 'z';
		const C = cmd.toUpperCase();

		if (C === 'M') {
			// move to, subsequent pairs are treated as implicit L
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break;
				pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += curX; y += curY; }
				curX = x; curY = y; subX = x; subY = y;
				// any additional pairs after the first are implicit L
				// Peek if more numbers follow without a new command
				const savePos = pos;
				pos = skipSeparators(src, pos);
				const nxt = readNumber(src, pos);
				if (nxt.value == null) { pos = savePos; break; }
				// revert and handle as implicit L in next loop iteration by setting cmd=L
				pos = savePos; cmd = isRel ? 'l' : 'L';
			}
			continue;
		}
		if (C === 'L') {
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break;
				pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += curX; y += curY; }
				const len = Math.hypot(x - curX, y - curY);
				const angle = Math.atan2(y - curY, x - curX);
				segs.push({ type: 'line', length: len, angle });
				lastControlX = null; lastControlY = null;
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'H') {
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = n1.next;
				let x = n1.value; if (isRel) x += curX;
				const len = Math.abs(x - curX);
				const angle = x > curX ? 0 : Math.PI; // horizontal: 0° right, 180° left
				segs.push({ type: 'line', length: len, angle });
				lastControlX = null; lastControlY = null;
				curX = x;
			}
			continue;
		}
		if (C === 'V') {
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = n1.next;
				let y = n1.value; if (isRel) y += curY;
				const len = Math.abs(y - curY);
				const angle = y > curY ? Math.PI / 2 : -Math.PI / 2; // vertical: 90° down, -90° up
				segs.push({ type: 'line', length: len, angle });
				lastControlX = null; lastControlY = null;
				curY = y;
			}
			continue;
		}
		if (C === 'A') {
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break; pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break; pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, pos); if (n3.value == null) break; pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, pos); if (n4.value == null) break; pos = skipSeparators(src, n4.next);
				const n5 = readNumber(src, pos); if (n5.value == null) break; pos = skipSeparators(src, n5.next);
				const n6 = readNumber(src, pos); if (n6.value == null) break; pos = skipSeparators(src, n6.next);
				const n7 = readNumber(src, pos); if (n7.value == null) break; pos = n7.next;
				const rx = n1.value, ry = n2.value, xRot = n3.value;
				const largeArc = n4.value, sweep = n5.value;
				let x = n6.value, y = n7.value;
				if (isRel) { x += curX; y += curY; }
				const len = arcLength(curX, curY, rx, ry, xRot, largeArc, sweep, x, y);
				segs.push({ type: 'arc', length: len, arcParams: { x1: curX, y1: curY, x2: x, y2: y, rx, ry, xRot, largeArc, sweep } });
				lastControlX = null; lastControlY = null; // Reset control point
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'C') {
			// Cubic Bézier: C x1 y1 x2 y2 x y (or c dx1 dy1 dx2 dy2 dx dy)
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break; pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break; pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, pos); if (n3.value == null) break; pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, pos); if (n4.value == null) break; pos = skipSeparators(src, n4.next);
				const n5 = readNumber(src, pos); if (n5.value == null) break; pos = skipSeparators(src, n5.next);
				const n6 = readNumber(src, pos); if (n6.value == null) break; pos = n6.next;
				let x1 = n1.value, y1 = n2.value;
				let x2 = n3.value, y2 = n4.value;
				let x = n5.value, y = n6.value;
				if (isRel) {
					x1 += curX; y1 += curY;
					x2 += curX; y2 += curY;
					x += curX; y += curY;
				}
				const pathData = `M ${curX},${curY} C ${x1},${y1} ${x2},${y2} ${x},${y}`;
				const len = curveLength(pathData);
				segs.push({ type: 'curve', length: len });
				lastControlX = x2; lastControlY = y2;
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'S') {
			// Smooth cubic Bézier: S x2 y2 x y (or s dx2 dy2 dx dy)
			// First control point is reflection of previous second control point
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break; pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break; pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, pos); if (n3.value == null) break; pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, pos); if (n4.value == null) break; pos = n4.next;
				// Reflect previous control point
				const x1 = lastControlX != null ? 2 * curX - lastControlX : curX;
				const y1 = lastControlY != null ? 2 * curY - lastControlY : curY;
				let x2 = n1.value, y2 = n2.value;
				let x = n3.value, y = n4.value;
				if (isRel) {
					x2 += curX; y2 += curY;
					x += curX; y += curY;
				}
				const pathData = `M ${curX},${curY} C ${x1},${y1} ${x2},${y2} ${x},${y}`;
				const len = curveLength(pathData);
				segs.push({ type: 'curve', length: len });
				lastControlX = x2; lastControlY = y2;
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'Q') {
			// Quadratic Bézier: Q x1 y1 x y (or q dx1 dy1 dx dy)
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break; pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break; pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, pos); if (n3.value == null) break; pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, pos); if (n4.value == null) break; pos = n4.next;
				let x1 = n1.value, y1 = n2.value;
				let x = n3.value, y = n4.value;
				if (isRel) {
					x1 += curX; y1 += curY;
					x += curX; y += curY;
				}
				const pathData = `M ${curX},${curY} Q ${x1},${y1} ${x},${y}`;
				const len = curveLength(pathData);
				segs.push({ type: 'curve', length: len });
				lastControlX = x1; lastControlY = y1;
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'T') {
			// Smooth quadratic Bézier: T x y (or t dx dy)
			// Control point is reflection of previous control point
			for (; ;) {
				pos = skipSeparators(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break; pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break; pos = n2.next;
				// Reflect previous control point
				const x1 = lastControlX != null ? 2 * curX - lastControlX : curX;
				const y1 = lastControlY != null ? 2 * curY - lastControlY : curY;
				let x = n1.value, y = n2.value;
				if (isRel) {
					x += curX; y += curY;
				}
				const pathData = `M ${curX},${curY} Q ${x1},${y1} ${x},${y}`;
				const len = curveLength(pathData);
				segs.push({ type: 'curve', length: len });
				lastControlX = x1; lastControlY = y1;
				curX = x; curY = y;
			}
			continue;
		}
		if (C === 'Z') {
			const len = Math.hypot(subX - curX, subY - curY);
			if (len > 0) {
				const angle = Math.atan2(subY - curY, subX - curX);
				segs.push({ type: 'line', length: len, angle });
			}
			lastControlX = null; lastControlY = null;
			curX = subX; curY = subY;
			continue;
		}
		// Unsupported command -> signal fallback
		haveUnsupported = true;
		break;
	}

	if (haveUnsupported) return null;
	return segs;
}

export { computeSegmentLengthsFromPath };
