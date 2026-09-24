// The OpenSpec Dashboard mark, as data: the in-app logo (logo.tsx) and the favicon (scripts/build-ui.ts) both draw it
// from here, so they never drift apart. A drafting sheet: faint construction lines overshoot a rounded square, ticks
// mark its corner-radius centres, and a hub sits in the middle. On the square's four edges sit the stations a change
// passes — an arrow for the proposal at the top, a document for the spec on the right, a triangle for the delta at the
// bottom and a prompt for the code on the left. Drawn on a 128×128 grid, in one ink on one ground.

export const MARK_VIEWBOX = "0 0 128 128";

/**
 * One element of the drawing. `fill` is a role, not a colour: `ink` is the stroke colour, `ground` the background the
 * mark sits on, which lets a node hide the square's outline behind it. `detail` parts are hair-thin construction marks
 * that a favicon leaves out.
 */
export interface MarkPart {
  el: "line" | "rect" | "circle" | "path";
  attrs: Record<string, number | string>;
  strokeWidth?: number;
  opacity?: number;
  fill: "none" | "ink" | "ground";
  detail?: boolean;
  /** Where the part is drawn, for the parts of a node, which are drawn around their own centre. */
  at?: [number, number];
}

const construction = (x1: number, y1: number, x2: number, y2: number): MarkPart => ({
  el: "line",
  attrs: { x1, y1, x2, y2, "stroke-dasharray": "3 4" },
  strokeWidth: 1,
  opacity: 0.3,
  fill: "none",
  detail: true,
});

const tick = (x: number, y: number): MarkPart => ({
  el: "line",
  attrs: { x1: x, y1: y - 6, x2: x, y2: y + 6 },
  strokeWidth: 1.6,
  opacity: 0.6,
  fill: "none",
  detail: true,
});

/** The rounded square the stations sit on. */
export const MARK_SQUARE: MarkPart = { el: "rect", attrs: { x: 20, y: 20, width: 88, height: 88, rx: 22 }, strokeWidth: 2.6, fill: "none" };

/** The four stations, clockwise from the top: a circle on the square's edge and the glyph inside it. */
export const MARK_NODES: { name: string; at: [number, number]; glyph: MarkPart[] }[] = [
  {
    name: "proposal",
    at: [64, 20],
    glyph: [
      { el: "path", attrs: { d: "M -4 -4 L 4 0 L -4 4", "stroke-linejoin": "round" }, strokeWidth: 2.4, fill: "none" },
      { el: "line", attrs: { x1: -7, y1: 0, x2: 2, y2: 0 }, strokeWidth: 2.2, fill: "none" },
    ],
  },
  {
    name: "spec",
    at: [108, 64],
    glyph: [
      { el: "rect", attrs: { x: -5, y: -6.5, width: 10, height: 13, rx: 1.5 }, strokeWidth: 2, fill: "none" },
      { el: "line", attrs: { x1: -2.5, y1: -2.5, x2: 2.5, y2: -2.5 }, strokeWidth: 1.8, fill: "none" },
      { el: "line", attrs: { x1: -2.5, y1: 0.5, x2: 2.5, y2: 0.5 }, strokeWidth: 1.8, fill: "none" },
      { el: "line", attrs: { x1: -2.5, y1: 3.5, x2: 0.5, y2: 3.5 }, strokeWidth: 1.8, fill: "none" },
    ],
  },
  {
    name: "delta",
    at: [64, 108],
    glyph: [{ el: "path", attrs: { d: "M 0 -5.5 L 5.5 4 L -5.5 4 Z", "stroke-linejoin": "round" }, strokeWidth: 2.2, fill: "none" }],
  },
  {
    name: "code",
    at: [20, 64],
    glyph: [
      { el: "path", attrs: { d: "M -4.5 -3.5 L -1 0 L -4.5 3.5", "stroke-linejoin": "round" }, strokeWidth: 2.2, fill: "none" },
      { el: "line", attrs: { x1: 1.5, y1: 3.5, x2: 5, y2: 3.5 }, strokeWidth: 2.2, fill: "none" },
    ],
  },
];

/** The whole drawing, in painting order. */
export const MARK_PARTS: MarkPart[] = [
  construction(8, 20, 120, 20),
  construction(8, 108, 120, 108),
  construction(20, 8, 20, 120),
  construction(108, 8, 108, 120),
  MARK_SQUARE,
  tick(36, 20),
  tick(92, 20),
  tick(36, 108),
  tick(92, 108),
  { el: "circle", attrs: { cx: 64, cy: 64, r: 3.5 }, strokeWidth: 2, fill: "ground" },
  { el: "circle", attrs: { cx: 64, cy: 64, r: 1.5 }, fill: "ink" },
  ...MARK_NODES.flatMap((node) => [
    { el: "circle", attrs: { cx: 0, cy: 0, r: 12 }, strokeWidth: 2.4, fill: "ground", at: node.at } satisfies MarkPart,
    ...node.glyph.map((part) => ({ ...part, at: node.at })),
  ]),
];

/** The favicon's frame: the square and the nodes that stick out of it, without the construction lines around them. */
export const FAVICON_VIEWBOX = "6 6 116 116";

/** How much heavier the favicon's strokes are, so that they survive being drawn at 16px. */
export const FAVICON_STROKE_SCALE = 1.75;

/**
 * The favicon: the same mark as a standalone SVG. A favicon cannot read the page's CSS tokens and must read on light
 * and dark tab strips, so it fills the square with the dark theme's --bg-base and inks in its --brand-fg, both written
 * out literally; they mirror styles.css. The construction details are left out: at 16px they would only be blur.
 */
export function faviconSvg(): string {
  const ink = "#a5b4fc";
  const ground = "#26272b";
  const body = MARK_PARTS.filter((part) => !part.detail).map((part) => {
    const fill = part === MARK_SQUARE ? ground : { none: "none", ink, ground }[part.fill];
    const attrs: Record<string, number | string> = { ...part.attrs, fill };
    if (part.strokeWidth !== undefined) Object.assign(attrs, { stroke: ink, "stroke-width": +(part.strokeWidth * FAVICON_STROKE_SCALE).toFixed(2) });
    if (part.opacity !== undefined) attrs.opacity = part.opacity;
    if (part.at) attrs.transform = `translate(${part.at[0]} ${part.at[1]})`;
    const written = Object.entries(attrs).map(([k, v]) => `${k}="${v}"`);
    return `<${part.el} ${written.join(" ")}/>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${FAVICON_VIEWBOX}">${body.join("")}</svg>`;
}
