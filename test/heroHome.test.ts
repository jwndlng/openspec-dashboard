// The hero's mark and title lead to the Projects overview (kanban-board: "The dashboard opens with a hero header").
import { expect, test } from "bun:test";
import { h } from "preact";
import { HeroHomeMark, HeroHomeTitle } from "../src/ui/heroHome.tsx";
import { href } from "../src/ui/url.ts";
import { byTag, textOf } from "./vnode.ts";

test("mark and title both link to the overview, and only the title is a stop", () => {
  const [mark] = byTag(h(HeroHomeMark, { size: 60 }), "a");
  const [title] = byTag(h(HeroHomeTitle, { current: false, children: "Spec Control" }), "a");
  expect(mark.props.href).toBe(href("/"));
  expect(title.props.href).toBe(href("/"));
  expect(mark.props.tabIndex).toBe(-1);
  expect(mark.props["aria-hidden"]).toBe("true");
  expect(title.props.tabIndex).toBeUndefined();
  expect(title.props["aria-hidden"]).toBeUndefined();
  expect(textOf(title)).toBe("Spec Control");
});

test("the title marks the overview as the current page only there", () => {
  expect(byTag(h(HeroHomeTitle, { current: true, children: "x" }), "a")[0].props["aria-current"]).toBe("page");
  expect(byTag(h(HeroHomeTitle, { current: false, children: "x" }), "a")[0].props["aria-current"]).toBeUndefined();
});

test("a modifier or middle click is left to the browser", () => {
  const [title] = byTag(h(HeroHomeTitle, { current: false, children: "x" }), "a");
  const [mark] = byTag(h(HeroHomeMark, { size: 48 }), "a");
  for (const link of [title, mark]) {
    for (const patch of [{ metaKey: true }, { ctrlKey: true }, { shiftKey: true }, { button: 1 }]) {
      let prevented = false;
      const event = { defaultPrevented: false, button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, ...patch, preventDefault: () => (prevented = true) };
      (link.props.onClick as (e: unknown) => void)(event);
      expect(prevented).toBe(false);
    }
  }
});
