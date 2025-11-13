#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
const { generateNetFromSvg } = require("../src/index");

async function main() {
	const argv = yargs(hideBin(process.argv))
		.usage("$0 --input input.svg [options]\n$0 --path 'M0,0 L100,0 L100,50 L0,50 Z' [options]")
		.option("input", {
			alias: "i",
			type: "string",
			describe: "Path to an SVG file that contains a single path element (first one is used)",
		})
		.option("path", {
			alias: "p",
			type: "string",
			describe: "SVG path data string (d attribute)",
		})
		.option("depth", {
			alias: "d",
			type: "number",
			default: 50,
			describe: "Extrusion depth for the prism (same units as input path)",
		})
		.option("height", { // deprecated alias
			type: "number",
			describe: "[deprecated] Use --depth instead",
		})
		.option("scale", {
			alias: "s",
			type: "number",
			default: 1,
			describe: "Scale factor applied to input path points",
		})
		.option("tolerance", {
			alias: "t",
			type: "number",
			default: 0.5,
			describe: "Flattening tolerance for curves (smaller = more segments)",
		})
		.option("min-segment", {
			alias: "ms",
			type: "number",
			default: 0.5,
			describe: "Minimum edge length; segments shorter than this are merged with the previous",
		})
		.option("margin", {
			alias: "m",
			type: "number",
			default: 10,
			describe: "Margin around the generated net in the output SVG",
		})
		.option("output", {
			alias: "o",
			type: "string",
			default: "assets/net.svg",
			describe: "Output SVG file path",
		})
		.option("unit", {
			alias: "u",
			type: "string",
			default: "px",
			describe: "Unit suffix for output SVG dimensions (e.g., px, mm)",
		})
		.help()
		.alias("help", "?")
		.epilog("shape-2-flat: generate a printable net from an SVG path")
		.strict()
		.parse();

	if (!argv.input && !argv.path) {
		console.error("Please provide either --input or --path");
		process.exit(1);
	}

	let svgContent = null;
	if (argv.input) {
		try {
			svgContent = fs.readFileSync(path.resolve(argv.input), "utf-8");
		} catch (e) {
			console.error("Failed to read input SVG:", e.message);
			process.exit(1);
		}
	}

	try {
		const depth = typeof argv.depth === "number" ? argv.depth : (typeof argv.height === "number" ? argv.height : 50);
		const { svg, meta } = await generateNetFromSvg({
			svgContent,
			pathData: argv.path || null,
			depth,
			scale: argv.scale,
			tolerance: argv.tolerance,
			minSegment: argv["min-segment"],
			margin: argv.margin,
			unit: argv.unit,
		});

		const outPath = path.resolve(argv.output);
		fs.mkdirSync(path.dirname(outPath), { recursive: true });
		fs.writeFileSync(outPath, svg, "utf-8");
		console.log(`Net generated: ${outPath}`);
		console.log(`Stats: faces=${meta.faces}, perimeter=${meta.perimeter.toFixed(2)}${argv.unit}, area=${meta.area.toFixed(2)}${argv.unit}^2`);
	} catch (e) {
		console.error("Error:", e.message);
		process.exit(1);
	}
}

main();
