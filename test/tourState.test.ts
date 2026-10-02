import { afterEach, expect, test } from "bun:test";
import { cardPlacement, loadTourSeen, NARROW_PX, saveTourSeen, setTourAutoStart, shouldAutoStart, stepLabel, TOUR_ANCHOR, TOUR_GUTTER, TOUR_STEPS, TOUR_STORAGE_KEY, tourAutoStarts, visibleSteps } from "../src/ui/tourState.ts";

const memory = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    data,
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
    },
  };
};
const throwing = {
  getItem: (): string | null => {
    throw new Error("denied");
  },
  setItem: () => {
    throw new Error("denied");
  },
};

test("the tour opens with a centred welcome and ends on Help", () => {
  expect(TOUR_STEPS[0].anchor).toBeUndefined();
  expect(TOUR_STEPS.at(-1)?.anchor).toBe(TOUR_ANCHOR.help);
  expect(TOUR_STEPS.map((s) => s.anchor).slice(1)).toEqual(["projects", "board", "activity", "pull-requests", "settings", "console", "refresh", "theme", "help"]);
  // At most two sentences each.
  for (const step of TOUR_STEPS) expect(step.text.split(/[.!?](?:\s|$)/).filter((s) => s.trim()).length).toBeLessThanOrEqual(2);
});

test("a step whose control is not on screen is left out and not counted", () => {
  const all = visibleSteps(TOUR_STEPS, () => true);
  expect(all).toHaveLength(10);
  const noConsole = visibleSteps(TOUR_STEPS, (a) => a !== TOUR_ANCHOR.console);
  expect(noConsole).toHaveLength(9);
  expect(noConsole.some((s) => s.anchor === TOUR_ANCHOR.console)).toBe(false);
  // The centred welcome needs no control.
  expect(visibleSteps(TOUR_STEPS, () => false)).toEqual([TOUR_STEPS[0]]);
  expect(stepLabel(2, noConsole.length)).toBe("3 of 9");
});

test("the card goes below the control, else above it, inside the window", () => {
  const viewport = { width: 1200, height: 800 };
  const card = { width: 340, height: 160 };
  const nav = { top: 200, left: 100, width: 120, height: 38 };
  expect(cardPlacement(nav, card, viewport)).toEqual({ top: 250, left: TOUR_GUTTER, width: 340 });
  const low = { top: 700, left: 600, width: 100, height: 30 };
  expect(cardPlacement(low, card, viewport)).toEqual({ top: 700 - 12 - 160, left: 480, width: 340 });
  // Right edge: clamped so the card stays inside the gutter.
  const corner = { top: 20, left: 1150, width: 40, height: 30 };
  expect(cardPlacement(corner, card, viewport).left).toBe(1200 - TOUR_GUTTER - 340);
  // Centred without a control.
  expect(cardPlacement(undefined, card, viewport)).toEqual({ top: 320, left: 430, width: 340 });
});

test("on a narrow window the card spans it and never covers the control", () => {
  const viewport = { width: 400, height: 700 };
  expect(viewport.width).toBeLessThan(NARROW_PX);
  const control = { top: 120, left: 300, width: 80, height: 34 };
  const placed = cardPlacement(control, { width: 340, height: 200 }, viewport);
  expect(placed.left).toBe(TOUR_GUTTER);
  expect(placed.width).toBe(400 - 2 * TOUR_GUTTER);
  expect(placed.top).toBeGreaterThanOrEqual(control.top + control.height);
  expect(placed.top + 200).toBeLessThanOrEqual(700 - TOUR_GUTTER);
});

test("the seen record: exact marker only, and a refusing storage is 'not seen' without an error", () => {
  const store = memory();
  expect(loadTourSeen(store)).toBe(false);
  saveTourSeen(store);
  expect(store.data[TOUR_STORAGE_KEY]).toBe("seen");
  expect(loadTourSeen(store)).toBe(true);
  expect(loadTourSeen(memory({ [TOUR_STORAGE_KEY]: "maybe" }))).toBe(false);
  expect(loadTourSeen(throwing)).toBe(false);
  expect(() => saveTourSeen(throwing)).not.toThrow();
});

afterEach(() => setTourAutoStart(true));

test("the tour starts by itself once, unseen, when ready and nothing else is open", () => {
  const base = { enabled: true, seen: false, alreadyStarted: false, ready: true, overlayOpen: false };
  expect(shouldAutoStart(base)).toBe(true);
  expect(shouldAutoStart({ ...base, seen: true })).toBe(false);
  expect(shouldAutoStart({ ...base, alreadyStarted: true })).toBe(false);
  expect(shouldAutoStart({ ...base, ready: false })).toBe(false);
  expect(shouldAutoStart({ ...base, overlayOpen: true })).toBe(false);
  expect(shouldAutoStart({ ...base, enabled: false })).toBe(false);
  expect(tourAutoStarts()).toBe(true);
  setTourAutoStart(false);
  expect(tourAutoStarts()).toBe(false);
});
