// The disk image's installer window (openspec/changes/styled-dmg-installer, design D4 and D7): its size, where the two
// icons sit, the background drawn behind them and the AppleScript that has Finder lay the window out. Constants and
// text only, no side effects, so `test/desktop/dmgLayout.test.ts` can check them; `style-dmg.ts` does the building.

export interface Point {
  x: number;
  y: number;
}

/** The volume's name. The background is referenced through it, so the image is created with it and never renamed. */
export const VOLUME_NAME = "Spec Control";
/** The app Electrobun puts into its disk image. */
export const APP_NAME = "Spec Control.app";
/** The link to `/Applications` beside it. */
export const APPLICATIONS_NAME = "Applications";
/** Where the background lies on the volume; the leading dot keeps it out of the window. */
export const BACKGROUND_DIR = ".background";
export const BACKGROUND_FILE = "background.tiff";

/** The window's content, in points; the background is drawn at this size and at twice it. */
export const WINDOW = { width: 640, height: 400 } as const;
/** Where the window opens on screen, top left, in points. */
export const WINDOW_ORIGIN: Point = { x: 200, y: 120 };
/** The title bar Finder adds above the content when the toolbar is hidden. */
export const TITLE_BAR_HEIGHT = 28;
export const ICON_SIZE = 128;
export const TEXT_SIZE = 13;
/** Icon centres in the window's content, as Finder's `position` takes them. */
export const APP_POSITION: Point = { x: 170, y: 180 };
export const APPLICATIONS_POSITION: Point = { x: 470, y: 180 };
/** The space the arrow keeps from each icon. */
const ARROW_GAP = 28;

export const INSTRUCTION = "Drag Spec Control to Applications to install it.";
const INSTRUCTION_Y = 330;

/** The arrow runs level between the icons, from just right of the app to just left of Applications. */
export function arrow(): { from: Point; to: Point } {
  return {
    from: { x: APP_POSITION.x + ICON_SIZE / 2 + ARROW_GAP, y: APP_POSITION.y },
    to: { x: APPLICATIONS_POSITION.x - ICON_SIZE / 2 - ARROW_GAP, y: APPLICATIONS_POSITION.y },
  };
}

/** The window's background: a light ground, a dotted arrow from the app to Applications, and the instruction line. */
export function backgroundSvg(): string {
  const { width, height } = WINDOW;
  const { from, to } = arrow();
  const head = 14;
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6f6f7"/><stop offset="1" stop-color="#e4e5e8"/></linearGradient></defs>`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#ground)"/>`,
    `<line x1="${from.x}" y1="${from.y}" x2="${to.x - head}" y2="${to.y}" stroke="#8a8c93" stroke-width="4" stroke-linecap="round" stroke-dasharray="0.1 12"/>`,
    `<path d="M ${to.x - head} ${to.y - head * 0.7} L ${to.x} ${to.y} L ${to.x - head} ${to.y + head * 0.7}" fill="none" stroke="#8a8c93" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`,
    `<text x="${width / 2}" y="${INSTRUCTION_Y}" text-anchor="middle" font-family="Helvetica Neue, Helvetica, Arial, sans-serif" font-size="15" fill="#4a4c52">${INSTRUCTION}</text>`,
    "</svg>",
  ].join("");
}

/** `text` as an AppleScript string literal. */
export function appleScriptString(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * The script that has Finder lay out the mounted volume: icon view without toolbar, status bar or sidebar, the window's
 * bounds, icon and text size, the background and both icons' positions. Closing and reopening the window is what makes
 * Finder write its `.DS_Store`.
 */
export function finderLayoutScript(names: { volume: string; app: string; applications: string } = { volume: VOLUME_NAME, app: APP_NAME, applications: APPLICATIONS_NAME }): string {
  const left = WINDOW_ORIGIN.x;
  const top = WINDOW_ORIGIN.y;
  const bounds = `{${left}, ${top}, ${left + WINDOW.width}, ${top + WINDOW.height + TITLE_BAR_HEIGHT}}`;
  const background = appleScriptString(`${BACKGROUND_DIR}:${BACKGROUND_FILE}`);
  return [
    `tell application "Finder"`,
    `  tell disk ${appleScriptString(names.volume)}`,
    "    open",
    "    set current view of container window to icon view",
    "    set toolbar visible of container window to false",
    "    set statusbar visible of container window to false",
    `    set the bounds of container window to ${bounds}`,
    "    set viewOptions to the icon view options of container window",
    "    set arrangement of viewOptions to not arranged",
    `    set icon size of viewOptions to ${ICON_SIZE}`,
    `    set text size of viewOptions to ${TEXT_SIZE}`,
    `    set background picture of viewOptions to file ${background}`,
    `    set position of item ${appleScriptString(names.app)} of container window to {${APP_POSITION.x}, ${APP_POSITION.y}}`,
    `    set position of item ${appleScriptString(names.applications)} of container window to {${APPLICATIONS_POSITION.x}, ${APPLICATIONS_POSITION.y}}`,
    "    close",
    "    open",
    "    update without registering applications",
    "    delay 2",
    "    close",
    "  end tell",
    "end tell",
  ].join("\n");
}
