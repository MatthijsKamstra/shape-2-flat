"use strict";

function numberMatcher() {
	return /[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // sticky numeric
}

function readNumber(src, pos) {
	const re = numberMatcher();
	re.lastIndex = pos;
	const m = re.exec(src);
	if (!m) return { value: null, next: pos };
	return { value: parseFloat(m[0]), next: re.lastIndex };
}

function skipWS(src, pos) {
	while (pos < src.length) {
		const ch = src[pos];
		if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === ',') pos++; else break;
	}
	return pos;
}

// Extract polygon vertices from path d if it only contains linear commands (M/L/H/V/Z). Returns null if any curve commands appear.
function extractLinearPolygon(d) {
	if (!d || typeof d !== 'string') return null;
	const src = d;
	let pos = 0;
	let cmd = null;
	let curX = 0, curY = 0;
	let subX = 0, subY = 0;
	const points = [];
	let sawCurve = false;

	function pushPoint(x, y) {
		if (points.length === 0 || Math.hypot(x - points[points.length - 1][0], y - points[points.length - 1][1]) > 1e-9) {
			points.push([x, y]);
		}
	}

	while (pos < src.length) {
		pos = skipWS(src, pos);
		const ch = src[pos];
		if (!ch) break;
		if (/[a-zA-Z]/.test(ch)) { cmd = ch; pos++; }
		else if (cmd == null) { break; }

		const isRel = (cmd >= 'a' && cmd <= 'z');
		const C = cmd.toUpperCase();

		if (C === 'M') {
			// First pair is move; subsequent pairs are implicit L
			let first = true;
			for (; ;) {
				pos = skipWS(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = skipWS(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break;
				pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += curX; y += curY; }
				curX = x; curY = y;
				if (first) { subX = x; subY = y; first = false; pushPoint(x, y); }
				else { // implicit L
					pushPoint(x, y);
				}
			}
			continue;
		}
		if (C === 'L') {
			for (; ;) {
				pos = skipWS(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = skipWS(src, n1.next);
				const n2 = readNumber(src, pos); if (n2.value == null) break;
				pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += curX; y += curY; }
				curX = x; curY = y;
				pushPoint(x, y);
			}
			continue;
		}
		if (C === 'H') {
			for (; ;) {
				pos = skipWS(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = n1.next;
				let x = n1.value; if (isRel) x += curX;
				curX = x;
				pushPoint(x, curY);
			}
			continue;
		}
		if (C === 'V') {
			for (; ;) {
				pos = skipWS(src, pos);
				const n1 = readNumber(src, pos); if (n1.value == null) break;
				pos = n1.next;
				let y = n1.value; if (isRel) y += curY;
				curY = y;
				pushPoint(curX, y);
			}
			continue;
		}
		if (C === 'Z') {
			// Close path: ensure closure is implicit; do not duplicate the first point.
			curX = subX; curY = subY;
			continue;
		}
		// Any other command means curves; bail out to use sampling path
		sawCurve = true;
		break;
	}

	if (sawCurve) return null;
	// Remove final duplicate point if matches first (shouldn't be added by our logic, safety)
	if (points.length > 2) {
		const [fx, fy] = points[0];
		const [lx, ly] = points[points.length - 1];
		if (Math.hypot(fx - lx, fy - ly) < 1e-9) points.pop();
	}
	return points.length >= 3 ? points : null;
}

export { extractLinearPolygon };
