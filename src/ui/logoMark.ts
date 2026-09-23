// The OpenSpec Dashboard mark, as data: the in-app logo (logo.tsx) and the favicon (scripts/build-ui.ts) both draw it
// from here, so they never drift apart. A ring broken into four arcs — the four stages a change passes through — that
// fades like a trail behind its leading arc, whose end carries a bright dot: the change, moving through its lifecycle.
// Around it sits the page it is written on, as a small rounded square. Drawn on a 48×48 grid.

export const MARK_VIEWBOX = "0 0 48 48";

/** The four arcs, clockwise from the top, each with the opacity of its place in the trail (the first one leads). */
export const MARK_ARCS: { d: string; opacity: number }[] = [
  { d: "M25.88 10.63A13.5 13.5 0 0 1 37.37 22.12", opacity: 1 },
  { d: "M37.37 25.88A13.5 13.5 0 0 1 25.88 37.37", opacity: 0.28 },
  { d: "M22.12 37.37A13.5 13.5 0 0 1 10.63 25.88", opacity: 0.5 },
  { d: "M10.63 22.12A13.5 13.5 0 0 1 22.12 10.63", opacity: 0.74 },
];

/** The leading dot at the end of the first arc. */
export const MARK_HEAD = { cx: 37.37, cy: 22.12, r: 3.6 };

/** The page in the middle. */
export const MARK_CORE = { x: 19.5, y: 19.5, size: 9, rx: 2.6 };

/** The tile the mark sits on. */
export const MARK_TILE_RADIUS = 13;

/**
 * The favicon: the same mark as a standalone SVG. A favicon cannot read the page's CSS tokens, so it carries the dark
 * theme's accent values literally; they mirror --brand-strong, --brand and --brand-fg in styles.css.
 */
export function faviconSvg(): string {
  const arcs = MARK_ARCS.map((a) => `<path d="${a.d}" stroke="#fff" stroke-opacity="${a.opacity}" stroke-width="4" stroke-linecap="round" fill="none"/>`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${MARK_VIEWBOX}">` +
    `<defs><linearGradient id="g" x1="0" y1="48" x2="48" y2="0" gradientUnits="userSpaceOnUse"><stop stop-color="#4f46e5"/><stop offset=".55" stop-color="#6366f1"/><stop offset="1" stop-color="#a5b4fc"/></linearGradient></defs>` +
    `<rect width="48" height="48" rx="${MARK_TILE_RADIUS}" fill="url(#g)"/>` +
    arcs +
    `<circle cx="${MARK_HEAD.cx}" cy="${MARK_HEAD.cy}" r="${MARK_HEAD.r}" fill="#fff"/>` +
    `<rect x="${MARK_CORE.x}" y="${MARK_CORE.y}" width="${MARK_CORE.size}" height="${MARK_CORE.size}" rx="${MARK_CORE.rx}" fill="#fff" fill-opacity=".92"/>` +
    "</svg>"
  );
}
