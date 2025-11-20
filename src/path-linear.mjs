"use strict";


/**
 * Return a sticky regular expression that matches numeric literals.
 *
 * Matches an optional sign, followed by one of:
 * - a sequence of digits with a decimal fraction (e.g. "12.34")
 * - digits with a trailing decimal point (e.g. "12.")
 * - a leading decimal point with digits (e.g. ".34")
 * - an integer (e.g. "12")
 * Optionally followed by an exponent part using "e" or "E" with an optional sign and digits (e.g. "1.2e-3").
 *
 * The returned RegExp uses the 'y' (sticky) flag so matches are attempted exactly at the
 * RegExp object's lastIndex when using exec/test.
 *
 * @returns {RegExp} A sticky RegExp that matches numeric literals (e.g. "3.14", ".5", "2.", "1e-3", "+4", "-.2E+10").
 */
function numberMatcher() {
	return /[+-]?(?:\d+\.\d+|\d+\.|\.\d+|\d+)(?:[eE][+-]?\d+)?/y; // sticky numeric
}

/**
 * Attempts to read a number from the given source string starting at the provided position.
 * Uses the RegExp returned by numberMatcher() and sets its lastIndex to `pos` before executing
 * to force matching at that position. If a match is found, the matched substring is parsed with
 * parseFloat and the function returns that numeric value along with the regular expression's
 * lastIndex (the position immediately after the match). If no match is found, returns { value: null, next: pos }.
 *
 * @param {string} src - The source string to parse the number from.
 * @param {number} pos - The index in `src` at which to start matching.
 * @returns {{ value: number | null, next: number }} An object containing the parsed numeric value (or null if no match)
 *                                                   and the next index in the source after the match (or the original pos if none).
 */
function readNumber(src, pos) {
	const re = numberMatcher();
	re.lastIndex = pos;
	const m = re.exec(src);
	if (!m) return { value: null, next: pos };
	return { value: parseFloat(m[0]), next: re.lastIndex };
}

/**
 * Advance an index past ASCII whitespace and comma characters in a source string.
 *
 * Starting from the provided index, increments the position while the current
 * character is one of: space (' '), tab ('\t'), carriage return ('\r'),
 * newline ('\n'), or comma (','). Stops when it reaches the end of the string
 * or encounters a non-matching character.
 *
 * @param {string} src - The input string to scan.
 * @param {number} pos - The starting index (0-based). If pos is already at or
 *   beyond src.length, it is returned unchanged.
 * @returns {number} The first index >= pos that points to a non-whitespace/non-comma
 *   character, or src.length if none remain.
 */
function skipWS(src, pos) {
	while (pos < src.length) {
		const ch = src[pos];
		if (ch === ' ' || ch === '\t' || ch === '\r' || ch === '\n' || ch === ',') pos++; else break;
	}
	return pos;
}

// Extract polygon vertices from path d if it only contains linear commands (M/L/H/V/Z). Returns null if any curve commands appear.
/**
 * Parse an SVG path string and extract a linear polygon (sequence of 2D points)
 * when the path contains only linear commands. Returns null if the input is
 * invalid, represents a non-polygon (fewer than 3 distinct points) or contains
 * any curve commands (bezier/arc) — in which case sampling must be used instead.
 *
 * Behavior and supported commands:
 * - Accepts absolute (upper-case) and relative (lower-case) commands.
 * - Supported commands: M (moveto), L (lineto), H (horizontal lineto),
 *   V (vertical lineto), Z / z (closepath).
 * - For an M command, the first coordinate pair begins a new subpath; any
 *   subsequent coordinate pairs in the same command are treated as implicit L
 *   commands.
 * - H and V adjust only one coordinate and preserve the other.
 * - Z closes the subpath by returning the current point to the subpath start
 *   (subX, subY) but does not add a duplicate closing point to the output.
 * - If any unsupported/curve command is encountered, parsing aborts and the
 *   function returns null.
 *
 * Parsing details:
 * - Leading/trailing whitespace and separators between numbers are skipped.
 * - Parsing relies on external helper functions `skipWS(src, pos)` and
 *   `readNumber(src, pos)` to advance position and read numeric values.
 * - Numeric parsing failures stop the current command's iteration.
 *
 * Deduplication & tolerance:
 * - Consecutive duplicate points are omitted using a distance tolerance of 1e-9
 *   (uses Math.hypot to compute distance).
 * - After parsing, if the last point equals the first within the same tolerance,
 *   the final duplicate is removed to avoid repeating the initial vertex.
 *
 * Return value:
 * - Returns an array of points [[x1,y1], [x2,y2], ...] when parsing succeeds and
 *   at least 3 distinct vertices remain (i.e. a valid polygon).
 * - Returns null for invalid input (non-string), parse failures, presence of
 *   curve commands, or fewer than 3 distinct points.
 *
 * Notes:
 * - The function updates internal cursors `curX`, `curY` for the current point
 *   and `subX`, `subY` for the current subpath's start; these are local to the
 *   parser and not exposed.
 * - This function is intended for paths that are strictly piecewise-linear;
 *   use a path-sampling approach when curves must be flattened to polylines.
 *
 * @param {string} d - SVG path data string to parse.
 * @returns {Array.<Array.<number>>|null} Array of [x, y] points representing
 *   the polygon, or null if the path is not a simple linear polygon.
 *
 * @example
 * // returns [[10,10],[20,10],[20,20]]
 * extractLinearPolygon("M10 10 L20 10 20 20 Z");
 *
 * @example
 * // returns null because of curve command
 * extractLinearPolygon("M0 0 C10 10 20 20 30 30");
 */
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
