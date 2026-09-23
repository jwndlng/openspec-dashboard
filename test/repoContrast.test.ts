// Guards the colour rules of the kanban-board spec: 4.5:1 for repository-coloured text on the tinted group panel
// and for every status role on a badge, and that repository hues never come near a status hue or the accent.
// Token values are read from styles.css so tuning a token re-runs the check against the real numbers.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_HUE_GAP, REPO_HUES } from "../src/ui/repoGroups.ts";

const css = readFileSync(join(import.meta.dir, "..", "src", "ui", "styles.css"), "utf8");

type Lch = { l: number; c: number; h: number };
type Rgb = [number, number, number];

function themeBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no ${selector} block in styles.css`);
  return css.slice(start, css.indexOf("\n}", start));
}

function token(block: string, name: string): string {
  const match = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  if (!match) throw new Error(`token ${name} not found`);
  return match[1].trim();
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

function hexToLinear(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1, 7), 16);
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

// OKLab matrices from Björn Ottosson's reference implementation.
function linearToLch([r, g, b]: Rgb): Lch {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { l: L, c: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function lchToLinear({ l: L, c, h }: Lch): Rgb {
  const A = c * Math.cos((h * Math.PI) / 180);
  const B = c * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const clip = (v: number) => Math.min(1, Math.max(0, v)); // browsers gamut-map; clipping is close enough for a threshold
  return [
    clip(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clip(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clip(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

/** `color-mix(in oklch, a share, b)`: linear in L and C, hue along the shorter arc. */
function mixOklch(a: Lch, b: Lch, share: number): Lch {
  let dh = a.h - b.h;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  return { l: b.l + (a.l - b.l) * share, c: b.c + (a.c - b.c) * share, h: (b.h + dh * share + 360) % 360 };
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

function contrast(x: Rgb, y: Rgb): number {
  const [hi, lo] = [luminance(x), luminance(y)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
}

/** The roles a status label may use (kanban-board: "Status labels use a semantic colour palette"). */
const ROLES = ["info", "branch", "success", "warning", "danger"] as const;
/** Grounds a badge is ever painted on: its own, and the card it usually sits in. */
const BADGE_GROUNDS = ["--bg-section", "--bg-raised"] as const;
/** The accent, which must stay out of the status palette and out of the repository hues. */
const ACCENTS = ["--brand", "--brand-fg"] as const;

/** Shortest distance between two hue angles, in degrees. */
function hueGap(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

for (const [theme, selector] of [["dark", ":root"], ["light", ':root[data-theme="light"]']] as const) {
  test(`repository name keeps 4.5:1 on the tinted group panel in the ${theme} theme`, () => {
    const block = themeBlock(selector);
    const l = Number(token(block, "--repo-l"));
    const c = Number(token(block, "--repo-c"));
    const share = Number.parseFloat(token(block, "--repo-group-mix")) / 100;
    const section = hexToLinear(token(block, "--bg-section"));
    expect(share).toBeGreaterThan(0);

    for (const h of REPO_HUES) {
      const repo: Lch = { l, c, h };
      const panel = lchToLinear(mixOklch(repo, linearToLch(section), share));
      const ratio = contrast(lchToLinear(repo), panel);
      if (ratio < 4.5) throw new Error(`${theme} hue ${h}: contrast ${ratio.toFixed(2)} < 4.5`);
      // the panel must actually differ from the plain column background
      expect(contrast(panel, section)).toBeGreaterThan(1.01);
    }
  });
}

// The Open work list: each row shows its repository name in the repository colour, on the list's raised ground
// (kanban-board spec, "Each repository has its own stable colour"). It is the one cross-repository view left.
for (const [theme, selector] of [["dark", ":root"], ["light", ':root[data-theme="light"]']] as const) {
  test(`an Open work row's repository name keeps 4.5:1 on the list's backgrounds in the ${theme} theme`, () => {
    const block = themeBlock(selector);
    const repoOf = (h: number): Lch => ({ l: Number(token(block, "--repo-l")), c: Number(token(block, "--repo-c")), h });

    for (const name of ["--bg-base", "--bg-section", "--bg-raised"]) {
      const background = hexToLinear(token(block, name));
      for (const h of REPO_HUES) {
        const ratio = contrast(lchToLinear(repoOf(h)), background);
        if (ratio < 4.5) throw new Error(`${theme} hue ${h} on ${name}: contrast ${ratio.toFixed(2)} < 4.5`);
      }
    }
  });
}

for (const [theme, selector] of [["dark", ":root"], ["light", ':root[data-theme="light"]']] as const) {
  test(`every status role keeps 4.5:1 on both badge grounds in the ${theme} theme`, () => {
    const block = themeBlock(selector);
    for (const role of ROLES) {
      const fg = hexToLinear(token(block, `--${role}`));
      for (const ground of BADGE_GROUNDS) {
        const ratio = contrast(fg, hexToLinear(token(block, ground)));
        if (ratio < 4.5) throw new Error(`${theme} --${role} on ${ground}: contrast ${ratio.toFixed(2)} < 4.5`);
      }
    }
  });

  test(`no repository hue comes within ${MIN_HUE_GAP}° of a status role or the accent in the ${theme} theme`, () => {
    const block = themeBlock(selector);
    const reserved = [...ROLES.map((r) => `--${r}`), ...ACCENTS].map((name) => ({
      name,
      hue: linearToLch(hexToLinear(token(block, name))).h,
    }));
    for (const repo of REPO_HUES) {
      for (const { name, hue } of reserved) {
        const gap = hueGap(repo, hue);
        if (gap < MIN_HUE_GAP) throw new Error(`${theme}: repository hue ${repo} is ${gap.toFixed(1)}° from ${name} (${hue.toFixed(1)}°)`);
      }
    }
  });
}

test("no badge role is painted in the brand accent", () => {
  // The accent belongs to focus, primary actions and progress. A status wearing it is the bug this palette fixed.
  const rules = [...css.matchAll(/^\.badge(\.[\w-]+)*\s*\{([^}]*)\}/gm)].map((m) => m[0]);
  expect(rules.length).toBeGreaterThan(4);
  for (const rule of rules) expect(rule).not.toMatch(/var\(--brand/);
  for (const role of ROLES) expect(css).toContain(`.badge.${role} { color: var(--${role});`);
});

test("the repository hues are distinct and spread", () => {
  expect(new Set(REPO_HUES).size).toBe(REPO_HUES.length);
  expect(REPO_HUES.length).toBe(19);
  const sorted = [...REPO_HUES].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    const gap = hueGap(sorted[i], sorted[(i + 1) % sorted.length]);
    if (gap < MIN_HUE_GAP) throw new Error(`repository hues ${sorted[i]} and ${sorted[(i + 1) % sorted.length]} are only ${gap.toFixed(1)}° apart`);
  }
});

test("colour math sanity: white on black is 21:1 and sRGB round-trips through OKLCH", () => {
  expect(contrast(hexToLinear("#ffffff"), hexToLinear("#000000"))).toBeCloseTo(21, 5);
  const rgb = hexToLinear("#71c7c5");
  const back = lchToLinear(linearToLch(rgb));
  for (let i = 0; i < 3; i++) expect(back[i]).toBeCloseTo(rgb[i], 4);
});

// Blue means "a live agent" on the Console tab. It is the `info` status role, so the hue-gap test above already keeps
// every repository colour away from it; what this guards is that the tab did not grow a literal colour of its own.
test("the Console tab is painted in the info role, never a literal colour", () => {
  const rules = [...css.matchAll(/^\.detail-tab\.console[^{]*\{([^}]*)\}/gm)].map((m) => m[1]);
  expect(rules.length).toBeGreaterThan(0);
  for (const rule of rules) {
    expect(rule).toMatch(/var\(--info/);
    expect(rule).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(rule).not.toMatch(/var\(--brand/);
  }
});
