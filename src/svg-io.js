"use strict";

const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");
const SvgPath = require("svgpath");

// 2D affine matrix helpers using SVG's [a b c d e f]
function matIdentity() { return [1, 0, 0, 1, 0, 0]; }
function matMul(m1, m2) {
	return [
		m1[0] * m2[0] + m1[2] * m2[1],
		m1[1] * m2[0] + m1[3] * m2[1],
		m1[0] * m2[2] + m1[2] * m2[3],
		m1[1] * m2[2] + m1[3] * m2[3],
		m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
		m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
	];
}
function matTranslate(tx = 0, ty = 0) { return [1, 0, 0, 1, tx, ty]; }
function matScale(sx = 1, sy = sx) { return [sx, 0, 0, sy, 0, 0]; }
function matRotate(deg, cx = 0, cy = 0) {
	const r = (deg * Math.PI) / 180;
	const cos = Math.cos(r), sin = Math.sin(r);
	const R = [cos, sin, -sin, cos, 0, 0];
	// translate to origin, rotate, translate back
	return matMul(matMul(matTranslate(cx, cy), R), matTranslate(-cx, -cy));
}
function matSkewX(deg) { const t = Math.tan((deg * Math.PI) / 180); return [1, 0, t, 1, 0, 0]; }
function matSkewY(deg) { const t = Math.tan((deg * Math.PI) / 180); return [1, t, 0, 1, 0, 0]; }

function parseTransform(str) {
	if (!str) return matIdentity();
	let M = matIdentity();
	const re = /([a-zA-Z]+)\s*\(([^)]+)\)/g;
	let m;
	while ((m = re.exec(str))) {
		const cmd = m[1].toLowerCase();
		const nums = m[2].split(/[\s,]+/).filter(Boolean).map(Number);
		let T = matIdentity();
		if (cmd === "matrix" && nums.length === 6) T = nums;
		else if (cmd === "translate") T = matTranslate(nums[0] || 0, nums[1] || 0);
		else if (cmd === "scale") T = matScale(nums[0] || 1, (nums.length > 1 ? nums[1] : nums[0]) || 1);
		else if (cmd === "rotate") T = (nums.length > 1) ? matRotate(nums[0] || 0, nums[1] || 0, nums[2] || 0) : matRotate(nums[0] || 0);
		else if (cmd === "skewx") T = matSkewX(nums[0] || 0);
		else if (cmd === "skewy") T = matSkewY(nums[0] || 0);
		M = matMul(M, T);
	}
	return M;
}

function cumulativeTransformMatrix(node) {
	// collect transforms from node up to root, then multiply from root to node
	const chain = [];
	for (let n = node; n && n.getAttribute; n = n.parentNode) {
		const tr = n.getAttribute("transform");
		if (tr) chain.push(parseTransform(tr));
	}
	let M = matIdentity();
	for (let i = chain.length - 1; i >= 0; i--) {
		M = matMul(M, chain[i]);
	}
	return M;
}

function applyCtmToPathD(d, node) {
	const M = cumulativeTransformMatrix(node);
	// if identity, skip
	if (M[0] === 1 && M[1] === 0 && M[2] === 0 && M[3] === 1 && M[4] === 0 && M[5] === 0) return d;
	return SvgPath(d).transform(`matrix(${M.join(" ")})`).toString();
}

function circleToPathD(cx, cy, r) {
	const x1 = cx + r, y1 = cy;
	const x2 = cx - r, y2 = cy;
	// two arcs to form a full circle
	return `M ${x1},${y1} A ${r} ${r} 0 1 0 ${x2} ${y2} A ${r} ${r} 0 1 0 ${x1} ${y1} Z`;
}

function ellipseToPathD(cx, cy, rx, ry) {
	const x1 = cx + rx, y1 = cy;
	const x2 = cx - rx, y2 = cy;
	return `M ${x1},${y1} A ${rx} ${ry} 0 1 0 ${x2} ${y2} A ${rx} ${ry} 0 1 0 ${x1} ${y1} Z`;
}

function extractPathInfo(svgContent) {
	if (!svgContent) return { d: null, kind: null };
	try {
		const doc = new DOMParser().parseFromString(svgContent, "text/xml");
		const select = xpath.useNamespaces({ svg: "http://www.w3.org/2000/svg" });
		// prefer explicit path
		let node = select("//svg:path[1]", doc)[0];
		if (node && node.getAttribute) {
			let d = node.getAttribute("d") || "";
			d = applyCtmToPathD(d, node);
			return { d, kind: "path" };
		}
		// rect
		node = select("//svg:rect[1]", doc)[0];
		if (node) {
			const x = parseFloat(node.getAttribute("x") || 0);
			const y = parseFloat(node.getAttribute("y") || 0);
			const w = parseFloat(node.getAttribute("width"));
			const h = parseFloat(node.getAttribute("height"));
			if (!isNaN(w) && !isNaN(h)) {
				let d = `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
				d = applyCtmToPathD(d, node);
				return { d, kind: "rect" };
			}
		}
		// circle
		node = select("//svg:circle[1]", doc)[0];
		if (node) {
			const cx = parseFloat(node.getAttribute("cx") || 0);
			const cy = parseFloat(node.getAttribute("cy") || 0);
			const r = parseFloat(node.getAttribute("r"));
			if (!isNaN(r)) {
				let d = circleToPathD(cx, cy, r);
				d = applyCtmToPathD(d, node);
				return { d, kind: "circle", shapeParams: { cx, cy, r } };
			}
		}
		// ellipse
		node = select("//svg:ellipse[1]", doc)[0];
		if (node) {
			const cx = parseFloat(node.getAttribute("cx") || 0);
			const cy = parseFloat(node.getAttribute("cy") || 0);
			const rx = parseFloat(node.getAttribute("rx"));
			const ry = parseFloat(node.getAttribute("ry"));
			if (!isNaN(rx) && !isNaN(ry)) {
				let d = ellipseToPathD(cx, cy, rx, ry);
				d = applyCtmToPathD(d, node);
				return { d, kind: "ellipse", shapeParams: { cx, cy, rx, ry } };
			}
		}
		// polygon/polyline
		node = select("//svg:polygon[1]", doc)[0] || select("//svg:polyline[1]", doc)[0];
		if (node) {
			const pts = (node.getAttribute("points") || "").trim();
			if (pts) {
				const coords = pts.split(/\s+/).map(p => p.split(",").map(Number));
				const path = ["M" + coords[0].join(",")]
					.concat(coords.slice(1).map(c => "L" + c.join(",")))
					.join(" ");
				const closed = node.tagName === "polygon" ? " Z" : "";
				let d = path + closed;
				d = applyCtmToPathD(d, node);
				return { d, kind: node.tagName };
			}
		}
		return { d: null, kind: null };
	} catch (e) {
		return { d: null, kind: null };
	}
}

function extractPathD(svgContent) {
	const { d } = extractPathInfo(svgContent);
	return d;
}

module.exports = { extractPathD, extractPathInfo };
