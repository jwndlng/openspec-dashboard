import { expect, test } from "bun:test";
import { focusOnce } from "../src/ui/focus.ts";

const field = () => {
  const el = { calls: 0, focus: () => { el.calls += 1; } };
  return el;
};

test("the first element is focused, and no render after it", () => {
  const ref = focusOnce();
  const name = field();
  ref(name);
  expect(name.calls).toBe(1);
  ref(name); // every later render re-runs the ref in the worst case: it must do nothing
  ref(name);
  expect(name.calls).toBe(1);
});

test("a detach and re-attach does not take the focus back", () => {
  const ref = focusOnce();
  const name = field();
  ref(name);
  ref(null);
  ref(name);
  expect(name.calls).toBe(1);
});

test("a null before the element still focuses it", () => {
  const ref = focusOnce();
  const name = field();
  ref(null);
  expect(name.calls).toBe(0);
  ref(name);
  expect(name.calls).toBe(1);
});

test("each form gets its own: one reopened form focuses again", () => {
  const first = field();
  const second = field();
  focusOnce()(first);
  focusOnce()(second);
  expect([first.calls, second.calls]).toEqual([1, 1]);
});
