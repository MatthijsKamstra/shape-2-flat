"use strict";

const { extractPathD } = require("./svg-io");
const { flattenPath, simplifyColinear } = require("./path-flatten");
const { makeNet } = require("./net");
const { renderNetSvg } = require("./render");

async function generateNetFromSvg({ svgContent, pathData, depth = 50, height, scale = 1, tolerance = 0.5, minSegment = 0.5, margin = 10, unit = "px" }) {
	const d = pathData || extractPathD(svgContent);
	if (!d) throw new Error("No SVG path data found");
	let poly = flattenPath(d, { tolerance, scale });
	poly = simplifyColinear(poly);
	if (poly.length < 3) throw new Error("Path must form a polygon with at least 3 points");
	const depthVal = typeof depth === "number" ? depth : (typeof height === "number" ? height : 50);
	const net = makeNet(poly, depthVal, { minSegment });
	const { svg, meta } = renderNetSvg(net, { margin, unit, page: { width: 210, height: 297 } });
	return { svg, meta };
}

module.exports = { generateNetFromSvg };
