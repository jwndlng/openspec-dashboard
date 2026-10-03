// The assignable hues shared by repository colours (kanban-board) and label colours (project-labels), and the hash
// that picks one deterministically. Pure: the theme supplies lightness and chroma in CSS.

/**
 * The hues a repository — or a label (project-labels) — may be painted in. Not a wheel: the status roles own six hues of their own
 * (danger, branch, warning, success, info, the indigo brand accent — see the token block in styles.css), and a
 * repository must never wear one of them, or its accent would read as "running" or "uncommitted". These 19 are
 * as many as the circle holds once each of those hues, in both themes, is given a ±12° berth and they keep 12° from
 * each other too: two below danger's berth, one between branch and warning, four between warning and success, five
 * between success and info, one between info and the accent, six between the accent and danger. The dark and the
 * light `info` share one hue for that reason: ten degrees apart, they would leave room for only 18. test/repoContrast.test.ts
 * recomputes both properties from the tokens rather than trusting this comment, so a retuned status colour fails
 * there instead of quietly colliding.
 */
export const REPO_HUES = [27, 39, 70, 105, 117, 129, 141, 178, 190, 202, 214, 226, 259, 290, 302, 314, 326, 338, 350];

/** The berth every repository hue keeps from every status hue, and from its neighbours, in degrees. */
export const MIN_HUE_GAP = 12;

/** FNV-1a, 32 bit: a stable, well-spread hash of a string. */
export function fnv1a(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

