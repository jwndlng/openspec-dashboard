import { expect, test } from "bun:test";
import { currentSection, navOffset, parseSection, rowScrollLeft, SECTION_IDS, serializeSection } from "../src/ui/settingsSections.ts";
import { hrefWithQuery } from "../src/ui/url.ts";

test("parseSection accepts known ids only", () => {
  expect(parseSection("?section=discovered", SECTION_IDS)).toBe("discovered");
  expect(parseSection("?q=x&section=shared-config", SECTION_IDS)).toBe("shared-config");
  expect(parseSection("?section=nope", SECTION_IDS)).toBeUndefined();
  expect(parseSection("", SECTION_IDS)).toBeUndefined();
  // A section that is not on the page right now is not a valid target.
  expect(parseSection("?section=shared-config", ["roots", "tracked"])).toBeUndefined();
});

test("serializeSection keeps other parameters and leaves the first section out of the URL", () => {
  expect(serializeSection("", "agents", "roots")).toBe("?section=agents");
  expect(serializeSection("?q=x", "agents", "roots")).toBe("?q=x&section=agents");
  expect(serializeSection("?section=agents&q=x", "scanning", "roots")).toBe("?section=scanning&q=x");
  expect(serializeSection("?section=agents&q=x", "roots", "roots")).toBe("?q=x");
  expect(serializeSection("?section=agents", undefined)).toBe("");
  expect(parseSection(serializeSection("", "tracked", "roots"), SECTION_IDS)).toBe("tracked");
});

const rects = (...tops: number[]) => tops.map((top, i) => ({ id: SECTION_IDS[i], top }));

test("at the top of the page the first section is current, even when the next one starts high up", () => {
  expect(currentSection(rects(16, 190, 900, 1300), false)).toBe("roots");
});

test("a section becomes current when its start reaches the top of the view", () => {
  expect(currentSection(rects(-174, 100, 810, 1210), false)).toBe("roots");
  expect(currentSection(rects(-180, 94, 804, 1204), false)).toBe("tracked");
  expect(currentSection(rects(-900, -700, 0, 400), false)).toBe("discovered");
});

test("at the end of the scroll range the last section is current, however short it is", () => {
  expect(currentSection(rects(-1500, -1300, -400, 300, 420, 600), true)).toBe("shared-config");
});

test("one section is always current; none is when there are no sections", () => {
  expect(currentSection(rects(400), false)).toBe("roots");
  expect(currentSection([], false)).toBeUndefined();
});

test("links to a section work in both routing modes", () => {
  expect(hrefWithQuery("/settings", "?section=agents", "path")).toBe("/settings?section=agents");
  expect(hrefWithQuery("/settings", "?section=agents", "hash")).toBe("?section=agents#/settings");
  expect(hrefWithQuery("/settings", "", "path")).toBe("/settings");
  // An empty query would resolve to the current one; "?" clears it.
  expect(hrefWithQuery("/settings", "", "hash")).toBe("?#/settings");
});

test("Settings defines what its effects call before it can return early", async () => {
  // Effects also run for the render that returned early (config still loading). A `const` declared after that return
  // is uninitialised there, and the ReferenceError aborts every later effect on the page.
  const source = await Bun.file(new URL("../src/ui/settings.tsx", import.meta.url)).text();
  const earlyReturn = source.indexOf("if (!draft) return");
  expect(earlyReturn).toBeGreaterThan(0);
  expect(source.indexOf("const runDiscovery")).toBeGreaterThan(0);
  expect(source.indexOf("const runDiscovery")).toBeLessThan(earlyReturn);
  expect(source.indexOf("useSectionNav(")).toBeLessThan(earlyReturn);
});

test("rowScrollLeft leaves the row alone when the entry is fully visible", () => {
  expect(rowScrollLeft({ scrollLeft: 0, clientWidth: 400 }, { offsetLeft: 120, offsetWidth: 150 })).toBe(0);
  expect(rowScrollLeft({ scrollLeft: 100, clientWidth: 400 }, { offsetLeft: 100, offsetWidth: 400 })).toBe(100);
});

test("rowScrollLeft makes the smallest shift that reveals a cut-off entry", () => {
  // Cut off on the right: its right edge meets the row's right edge.
  expect(rowScrollLeft({ scrollLeft: 0, clientWidth: 400 }, { offsetLeft: 350, offsetWidth: 150 })).toBe(100);
  // Cut off on the left: its left edge meets the row's left edge.
  expect(rowScrollLeft({ scrollLeft: 300, clientWidth: 400 }, { offsetLeft: 120, offsetWidth: 150 })).toBe(120);
  expect(rowScrollLeft({ scrollLeft: 300, clientWidth: 400 }, { offsetLeft: 0, offsetWidth: 90 })).toBe(0);
});

test("rowScrollLeft aligns an entry wider than the row to its start", () => {
  expect(rowScrollLeft({ scrollLeft: 0, clientWidth: 200 }, { offsetLeft: 260, offsetWidth: 320 })).toBe(260);
});

test("the navigation never scrolls the page to reveal itself", async () => {
  // scrollIntoView on a navigation element would scroll the page whenever the current section changes; the only
  // legitimate use is scrolling a section to the top on a jump.
  const source = await Bun.file(new URL("../src/ui/settingsNav.tsx", import.meta.url)).text();
  const calls = source.match(/^.*\.scrollIntoView\(.*$/gm) ?? [];
  expect(calls).toHaveLength(1);
  expect(calls[0]).toContain("target?.scrollIntoView");
  expect(source.indexOf("target?.scrollIntoView")).toBeLessThan(source.indexOf("// Follow manual scrolling."));
});

test("navOffset keeps the navigation level with the current section, in view while it is read", () => {
  const nav = 200;
  const layout = 3000;
  // At the top of the page: home.
  expect(navOffset({ sectionTop: 0, sectionBottom: 300, viewTop: 0 }, nav, layout)).toBe(0);
  // The section's start is in view below the top: level with it.
  expect(navOffset({ sectionTop: 1200, sectionBottom: 2400, viewTop: 1150 }, nav, layout)).toBe(1200);
  // Reading further down a tall section: level with the top of the view.
  expect(navOffset({ sectionTop: 1200, sectionBottom: 2400, viewTop: 1800 }, nav, layout)).toBe(1800);
  // Near its end: stops where it ends with the section.
  expect(navOffset({ sectionTop: 1200, sectionBottom: 2400, viewTop: 2350 }, nav, layout)).toBe(2200);
  // A section shorter than the navigation: level with its start.
  expect(navOffset({ sectionTop: 1200, sectionBottom: 1300, viewTop: 1250 }, nav, layout)).toBe(1200);
  // A short last section: the navigation stays inside the page.
  expect(navOffset({ sectionTop: 2900, sectionBottom: 3000, viewTop: 2700 }, nav, layout)).toBe(2800);
  // Navigation taller than the layout.
  expect(navOffset({ sectionTop: 400, sectionBottom: 500, viewTop: 400 }, 500, 300)).toBe(0);
});

test("the navigation moves with the content and is never pinned", async () => {
  const css = await Bun.file(new URL("../src/ui/styles.css", import.meta.url)).text();
  const navRules = css.match(/^\s*\.settings-nav \{[^}]*\}/gm) ?? [];
  expect(navRules.length).toBeGreaterThan(0);
  // Neither pinned (sticky/fixed) nor a scroll area of its own that the page would scroll past.
  for (const rule of navRules) expect(rule).not.toMatch(/position: (sticky|fixed)|overflow-y/);
  // Wide: level with the current section; narrow: the row stays above the sections.
  expect(navRules[0]).toContain("top: var(--nav-offset, 0px)");
  expect(navRules.at(-1)).toContain("top: 0");
  // Only the one scroll area: sections with their own overflow would leave the navigation standing still.
  expect(css).not.toMatch(/^\.settings \{[^}]*overflow/m);
});

// The demo build sizes #app in demo.css, so a check against the demo alone passed while `bun run dev` and the binary
// scrolled the whole document and .settings-scroll never scrolled.
test("the product sizes the mount point, so .settings-scroll is the page's scroll area outside the demo too", async () => {
  const css = await Bun.file(new URL("../src/ui/styles.css", import.meta.url)).text();
  expect(css).toMatch(/^html, body \{ height: 100%; \}/m);
  expect(css).toMatch(/^#app \{[^}]*height: 100%/m);
  expect(css).toMatch(/^\.app \{[^}]*height: 100%/m);
  expect(css).toMatch(/^\.settings-scroll \{[^}]*flex: 1; min-height: 0; overflow: auto;/m);
});
