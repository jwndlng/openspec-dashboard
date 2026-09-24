// The product mark: one drawing shared by the hero mark and the favicon, which is standalone and leaves out the details.
import { expect, test } from "bun:test";
import { faviconSvg, MARK_NODES, MARK_PARTS, MARK_SQUARE } from "../src/ui/logoMark.ts";

test("the mark has four stations on the square's edges", () => {
  expect(MARK_NODES.map((n) => n.name)).toEqual(["proposal", "spec", "delta", "code"]);
  const { x, y, width } = MARK_SQUARE.attrs as { x: number; y: number; width: number };
  for (const { at } of MARK_NODES) expect([x, x + width / 2, x + width]).toContain(at[0]);
  for (const { at } of MARK_NODES) expect([y, y + width / 2, y + width]).toContain(at[1]);
});

test("the favicon is a standalone SVG that references nothing", () => {
  const svg = faviconSvg();
  expect(svg).toStartWith('<svg xmlns="http://www.w3.org/2000/svg"');
  expect(svg).not.toMatch(/href|url\(|var\(|currentColor/);
});

test("the favicon draws every part but the construction details", () => {
  const svg = faviconSvg();
  expect(svg).not.toContain("stroke-dasharray");
  const drawn = svg.match(/<(?:line|rect|circle|path) /g) ?? [];
  expect(drawn).toHaveLength(MARK_PARTS.filter((p) => !p.detail).length);
  for (const node of MARK_NODES) {
    expect(svg).toContain(`translate(${node.at[0]} ${node.at[1]})`);
    for (const part of node.glyph) if (part.el === "path") expect(svg).toContain(`d="${part.attrs.d}"`);
  }
});
