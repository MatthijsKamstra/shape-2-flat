"use strict";

const { DOMParser } = require("@xmldom/xmldom");
const xpath = require("xpath");

function extractPathD(svgContent) {
	if (!svgContent) return null;
	try {
		const doc = new DOMParser().parseFromString(svgContent, "text/xml");
		// prefer explicit path; fallback to rect, polygon, polyline
		const select = xpath.useNamespaces({ svg: "http://www.w3.org/2000/svg" });
		let node = select("//svg:path[1]", doc)[0];
		if (node && node.getAttribute) return node.getAttribute("d");
		// rect to path
		node = select("//svg:rect[1]", doc)[0];
		if (node) {
			const x = parseFloat(node.getAttribute("x") || 0);
			const y = parseFloat(node.getAttribute("y") || 0);
			const w = parseFloat(node.getAttribute("width"));
			const h = parseFloat(node.getAttribute("height"));
			if (!isNaN(w) && !isNaN(h)) {
				return `M${x},${y} L${x + w},${y} L${x + w},${y + h} L${x},${y + h} Z`;
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
				return path + closed;
			}
		}
		return null;
	} catch (e) {
		return null;
	}
}

module.exports = { extractPathD };
