# Copilot Guide

This repo contains a small Node.js CLI to generate a papercraft net from an SVG path.

Common prompts:

- “Rotate base so longest edge is vertical.” -> See `makeNet` in `src/net.js`.
- “Make side rectangles match edge lengths and depth.” -> See `sideRects` construction in `src/net.js`.
- “Keep white fill, black stroke.” -> See styles in `src/render.js`.
- “Connect shapes without gaps.” -> Gap is zero in `render.js`.

Also:

- A4 output is set in `src/index.js` when calling `renderNetSvg`.
- Tiny edge segments are merged in `src/net.js` using the `minSegment` option.

When editing:

- Prefer small, focused changes.
- Update README if behavior changes.
- Add options to the CLI only when needed; keep default sane.
