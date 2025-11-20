#!/usr/bin/env node
"use strict";

const fs = require("fs");
const yargs = require("yargs");
const { hideBin } = require("yargs/helpers");
// load ESM core at runtime
let generateNet;

async function main() {
	const argv = yargs(hideBin(process.argv))
		.usage("$0 --input input.svg [options]\n$0 --path 'M0,0 L100,0 L100,50 L0,50 Z' [options]")
		.option("input", { alias: "i", type: "string", describe: "Path to an SVG file" })
		.option("path", { alias: "p", type: "string", describe: "SVG path data string" })
		.option("depth", { alias: "d", type: "number", default: 50, describe: "Extrusion depth" })
		.option("height", { type: "number", describe: "[deprecated] Use --depth instead" })
		.option("scale", { alias: "s", type: "number", default: 1, describe: "Scale factor" })
		.option("tolerance", { alias: "t", type: "number", default: 0.5, describe: "Curve flatten tolerance" })
		.option("min-segment", { alias: "ms", type: "number", default: 0.5, describe: "Merge edges shorter than this" })
		.option("margin", { alias: "m", type: "number", default: 10, describe: "Margin around content" })
		.option("unit", { alias: "u", type: "string", default: "mm", describe: "Unit suffix" })
		.option("output", { alias: "o", type: "string", default: "assets/net.svg", describe: "Output SVG file" })
		.option("debug", { type: "boolean", default: true, describe: "Include DEBUG group (centers & circles)" })
		.help()
		.strict()
		.parse();

	const { input, path, depth, height, scale, tolerance, minSegment, margin, unit, output, debug } = argv;
	if (!input && !path) {
		console.error("Provide --input or --path");
		process.exit(1);
	}

	const svgContent = input ? fs.readFileSync(input, "utf8") : undefined;
	if (!generateNet) {
		const mod = await import('../src/core.mjs');
		generateNet = mod.generateNet || mod.default || mod;
	}
	const { svg, meta } = generateNet({
		svgContent,
		pathData: path,
		depth,
		height,
		scale,
		tolerance,
		minSegment,
		margin,
		unit,
		debug,
	});

	fs.writeFileSync(output, svg, "utf8");
	console.log(`Wrote ${output} (perimeter=${meta.perimeter.toFixed(2)} ${unit})`);
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
