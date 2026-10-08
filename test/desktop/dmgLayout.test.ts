import { expect, test } from "bun:test";
import {
  APP_NAME,
  APP_POSITION,
  APPLICATIONS_NAME,
  APPLICATIONS_POSITION,
  appleScriptString,
  arrow,
  backgroundSvg,
  finderLayoutScript,
  ICON_SIZE,
  INSTRUCTION,
  VOLUME_NAME,
  WINDOW,
} from "../../desktop/scripts/dmgLayout.ts";

/** The icon's square plus room for its label below it. */
function box(at: { x: number; y: number }) {
  return { left: at.x - ICON_SIZE / 2, right: at.x + ICON_SIZE / 2, top: at.y - ICON_SIZE / 2, bottom: at.y + ICON_SIZE / 2 + 24 };
}

test("both icons, with their labels, lie inside the window", () => {
  for (const at of [APP_POSITION, APPLICATIONS_POSITION]) {
    const b = box(at);
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.top).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(WINDOW.width);
    expect(b.bottom).toBeLessThanOrEqual(WINDOW.height);
  }
});

test("the app is on the left, Applications on the right, apart", () => {
  expect(box(APP_POSITION).right).toBeLessThan(box(APPLICATIONS_POSITION).left);
  expect(APP_POSITION.y).toBe(APPLICATIONS_POSITION.y);
});

test("the arrow runs from the app towards Applications, between them", () => {
  const { from, to } = arrow();
  expect(from.x).toBeGreaterThan(box(APP_POSITION).right);
  expect(to.x).toBeLessThan(box(APPLICATIONS_POSITION).left);
  expect(from.x).toBeLessThan(to.x);
  expect(from.y).toBe(APP_POSITION.y);
  expect(to.y).toBe(APPLICATIONS_POSITION.y);
});

test("the background is the window's size and says what to do", () => {
  const svg = backgroundSvg();
  expect(svg).toContain(`viewBox="0 0 ${WINDOW.width} ${WINDOW.height}"`);
  expect(svg).toContain(INSTRUCTION);
  expect(INSTRUCTION).toBe("Drag Spec Control to Applications to install it.");
});

test("AppleScript strings escape quotes and backslashes", () => {
  expect(appleScriptString("Spec Control")).toBe('"Spec Control"');
  expect(appleScriptString('say "hi"')).toBe('"say \\"hi\\""');
  expect(appleScriptString("a\\b")).toBe('"a\\\\b"');
});

test("the Finder script names the volume, the app, Applications and the background", () => {
  const script = finderLayoutScript();
  expect(script).toContain(`tell disk "${VOLUME_NAME}"`);
  expect(script).toContain(`item "${APP_NAME}" of container window to {${APP_POSITION.x}, ${APP_POSITION.y}}`);
  expect(script).toContain(`item "${APPLICATIONS_NAME}" of container window to {${APPLICATIONS_POSITION.x}, ${APPLICATIONS_POSITION.y}}`);
  expect(script).toContain('background picture of viewOptions to file ".background:background.tiff"');
  expect(script).toContain(`icon size of viewOptions to ${ICON_SIZE}`);
  expect(script).toContain("toolbar visible of container window to false");
});

test("names with quotes reach the script escaped", () => {
  const script = finderLayoutScript({ volume: 'Odd "Name"', app: 'Odd "Name".app', applications: APPLICATIONS_NAME });
  expect(script).toContain('tell disk "Odd \\"Name\\""');
  expect(script).toContain('item "Odd \\"Name\\".app"');
});
