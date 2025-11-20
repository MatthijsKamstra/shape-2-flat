"use strict";

// Geometry helpers (length + centers)
import { arcLength, curveLength } from './geometry.mjs';

function numberMatcher() {
	return /[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // sticky
}

function isCommand(ch) {
	return /[a-zA-Z]/.test(ch);
}

/**
 * Read a number from a string starting at a given position.
 *
 * Uses numberMatcher() to obtain a RegExp, sets its lastIndex to the provided
 * start position, and attempts to match a numeric token at that location.
 *
 * On success the matched substring is converted to a Number with parseFloat and
 * the returned `next` is the regex's lastIndex (the position immediately after
 * the match). If no numeric match is found the function returns `value: null`
 * and `next` equal to the original `pos`.
 *
 * Note: this function mutates the RegExp's lastIndex property when the matcher
 * produced by numberMatcher() has the `g` or `y` flags.
 *
 * @param {string} src - The source string to read from.
 * @param {number} pos - The index in src to start matching from.
 * @returns {{ value: number | null, next: number }} An object containing the
 *          parsed numeric value (or null if no match) and the next index after
 *          the match (or the original position if none).
 */
function readNumber(src, pos) {
	const re = numberMatcher();
	re.lastIndex = pos;
	const m = re.exec(src);
	if (!m) return { value: null, next: pos };
	return { value: parseFloat(m[0]), next: re.lastIndex };
}

/**
 * Advance the index past separator characters in a string.
 *
 * Scans forward from the provided starting index and skips any of the following
 * ASCII separators: comma (','), space (' '), newline ('\n'), tab ('\t'),
 * and carriage return ('\r'). Returns the index of the first non-separator
 * character or src.length if the end of the string is reached.
 *
 * @param {string} src - The string to scan.
 * @param {number} pos - The zero-based starting index within src.
 * @returns {number} The index of the first character after skipped separators.
 *
 * @example
 * // returns 3
 * // skips the comma and space after the 'a'
 * skipSeparators("a, b", 1);
 */
function skipSeparators(src, pos) {
	while (pos < src.length) {
		const ch = src[pos];
		if (ch === ',' || ch === ' ' || ch === '\n' || ch === '\t' || ch === '\r') pos++;
		else break;
	}
	return pos;
}

// Returns an array of { type: 'line'|'arc'|'curve', length }
function computeSegmentLengthsFromPath(d) {
	if (!d) return null;
	const src = d;
	const state = {
		src,
		pos: 0,
		cmd: null,
		curX: 0,
		curY: 0,
		subX: 0,
		subY: 0,
		lastControlX: null,
		lastControlY: null,
		segs: [],
		unsupported: false
	};

	const handlers = {
		M(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break;
				state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break;
				state.pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += state.curX; y += state.curY; }
				state.curX = x; state.curY = y; state.subX = x; state.subY = y;
				const savePos = state.pos;
				state.pos = skipSeparators(src, state.pos);
				const nxt = readNumber(src, state.pos);
				if (nxt.value == null) { state.pos = savePos; break; }
				state.pos = savePos; state.cmd = isRel ? 'l' : 'L';
			}
		},
		L(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break;
				state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break;
				state.pos = n2.next;
				let x = n1.value, y = n2.value;
				if (isRel) { x += state.curX; y += state.curY; }
				const len = Math.hypot(x - state.curX, y - state.curY);
				const angle = Math.atan2(y - state.curY, x - state.curX);
				state.segs.push({ type: 'line', length: len, angle, x1: state.curX, y1: state.curY, x2: x, y2: y });
				state.lastControlX = null; state.lastControlY = null;
				state.curX = x; state.curY = y;
			}
		},
		H(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break;
				state.pos = n1.next;
				let x = n1.value; if (isRel) x += state.curX;
				const len = Math.abs(x - state.curX);
				const angle = x > state.curX ? 0 : Math.PI;
				state.segs.push({ type: 'line', length: len, angle, x1: state.curX, y1: state.curY, x2: x, y2: state.curY });
				state.lastControlX = null; state.lastControlY = null;
				state.curX = x;
			}
		},
		V(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break;
				state.pos = n1.next;
				let y = n1.value; if (isRel) y += state.curY;
				const len = Math.abs(y - state.curY);
				const angle = y > state.curY ? Math.PI / 2 : -Math.PI / 2;
				state.segs.push({ type: 'line', length: len, angle, x1: state.curX, y1: state.curY, x2: state.curX, y2: y });
				state.lastControlX = null; state.lastControlY = null;
				state.curY = y;
			}
		},
		A(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break; state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break; state.pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, state.pos); if (n3.value == null) break; state.pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, state.pos); if (n4.value == null) break; state.pos = skipSeparators(src, n4.next);
				const n5 = readNumber(src, state.pos); if (n5.value == null) break; state.pos = skipSeparators(src, n5.next);
				const n6 = readNumber(src, state.pos); if (n6.value == null) break; state.pos = skipSeparators(src, n6.next);
				const n7 = readNumber(src, state.pos); if (n7.value == null) break; state.pos = n7.next;
				let rx = n1.value, ry = n2.value, xRot = n3.value;
				let largeArc = n4.value, sweep = n5.value;
				let x = n6.value, y = n7.value;
				if (isRel) { x += state.curX; y += state.curY; }
				const len = arcLength(state.curX, state.curY, rx, ry, xRot, largeArc, sweep, x, y);
				state.segs.push({ type: 'arc', length: len, arcParams: { x1: state.curX, y1: state.curY, x2: x, y2: y, rx, ry, xRot, largeArc, sweep } });
				state.lastControlX = null; state.lastControlY = null;
				state.curX = x; state.curY = y;
			}
		},
		C(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break; state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break; state.pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, state.pos); if (n3.value == null) break; state.pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, state.pos); if (n4.value == null) break; state.pos = skipSeparators(src, n4.next);
				const n5 = readNumber(src, state.pos); if (n5.value == null) break; state.pos = skipSeparators(src, n5.next);
				const n6 = readNumber(src, state.pos); if (n6.value == null) break; state.pos = n6.next;
				let x1 = n1.value, y1 = n2.value;
				let x2 = n3.value, y2 = n4.value;
				let x = n5.value, y = n6.value;
				if (isRel) {
					x1 += state.curX; y1 += state.curY;
					x2 += state.curX; y2 += state.curY;
					x += state.curX; y += state.curY;
				}
				const pathData = `M ${state.curX},${state.curY} C ${x1},${y1} ${x2},${y2} ${x},${y}`;
				const len = curveLength(pathData);
				state.segs.push({ type: 'curve', length: len, x1: state.curX, y1: state.curY, x2: x, y2: y, cx1: x1, cy1: y1, cx2: x2, cy2: y2 });
				state.lastControlX = x2; state.lastControlY = y2;
				state.curX = x; state.curY = y;
			}
		},
		S(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break; state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break; state.pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, state.pos); if (n3.value == null) break; state.pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, state.pos); if (n4.value == null) break; state.pos = n4.next;
				const x1 = state.lastControlX != null ? 2 * state.curX - state.lastControlX : state.curX;
				const y1 = state.lastControlY != null ? 2 * state.curY - state.lastControlY : state.curY;
				let x2 = n1.value, y2 = n2.value;
				let x = n3.value, y = n4.value;
				if (isRel) { x2 += state.curX; y2 += state.curY; x += state.curX; y += state.curY; }
				const pathData = `M ${state.curX},${state.curY} C ${x1},${y1} ${x2},${y2} ${x},${y}`;
				const len = curveLength(pathData);
				state.segs.push({ type: 'curve', length: len, x1: state.curX, y1: state.curY, x2: x, y2: y, cx1: x1, cy1: y1, cx2: x2, cy2: y2 });
				state.lastControlX = x2; state.lastControlY = y2;
				state.curX = x; state.curY = y;
			}
		},
		Q(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break; state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break; state.pos = skipSeparators(src, n2.next);
				const n3 = readNumber(src, state.pos); if (n3.value == null) break; state.pos = skipSeparators(src, n3.next);
				const n4 = readNumber(src, state.pos); if (n4.value == null) break; state.pos = n4.next;
				let x1 = n1.value, y1 = n2.value;
				let x = n3.value, y = n4.value;
				if (isRel) { x1 += state.curX; y1 += state.curY; x += state.curX; y += state.curY; }
				const pathData = `M ${state.curX},${state.curY} Q ${x1},${y1} ${x},${y}`;
				const len = curveLength(pathData);
				state.segs.push({ type: 'curve', length: len, x1: state.curX, y1: state.curY, x2: x, y2: y, cx1: x1, cy1: y1, isQuadratic: true });
				state.lastControlX = x1; state.lastControlY = y1;
				state.curX = x; state.curY = y;
			}
		},
		T(isRel) {
			for (; ;) {
				state.pos = skipSeparators(src, state.pos);
				const n1 = readNumber(src, state.pos); if (n1.value == null) break; state.pos = skipSeparators(src, n1.next);
				const n2 = readNumber(src, state.pos); if (n2.value == null) break; state.pos = n2.next;
				const x1 = state.lastControlX != null ? 2 * state.curX - state.lastControlX : state.curX;
				const y1 = state.lastControlY != null ? 2 * state.curY - state.lastControlY : state.curY;
				let x = n1.value, y = n2.value;
				if (isRel) { x += state.curX; y += state.curY; }
				const pathData = `M ${state.curX},${state.curY} Q ${x1},${y1} ${x},${y}`;
				const len = curveLength(pathData);
				state.segs.push({ type: 'curve', length: len, x1: state.curX, y1: state.curY, x2: x, y2: y, cx1: x1, cy1: y1, isQuadratic: true });
				state.lastControlX = x1; state.lastControlY = y1;
				state.curX = x; state.curY = y;
			}
		},
		Z() {
			const len = Math.hypot(state.subX - state.curX, state.subY - state.curY);
			if (len > 0) {
				const angle = Math.atan2(state.subY - state.curY, state.subX - state.curX);
				state.segs.push({ type: 'line', length: len, angle, x1: state.curX, y1: state.curY, x2: state.subX, y2: state.subY });
			}
			state.lastControlX = null; state.lastControlY = null;
			state.curX = state.subX; state.curY = state.subY;
		}
	};

	while (state.pos < src.length) {
		state.pos = skipSeparators(src, state.pos);
		const ch = src[state.pos];
		if (!ch) break;
		if (isCommand(ch)) { state.cmd = ch; state.pos++; }
		else if (state.cmd == null) { break; }
		const isRel = state.cmd >= 'a' && state.cmd <= 'z';
		const C = state.cmd.toUpperCase();
		const handler = handlers[C];
		if (!handler) { state.unsupported = true; break; }
		handler(isRel);
	}
	if (state.unsupported) return null;
	return state.segs;
}

export { computeSegmentLengthsFromPath };
