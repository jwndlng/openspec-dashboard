// The collapsed dock reserves DOCK_TABS_HEIGHT below the board; that must be exactly the tab strip's CSS height, or
// the board's last row hides behind the strip (kanban-board: "Session tabs read as tabs", scenario "Collapsed dock").
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DOCK_TABS_HEIGHT } from "../src/ui/sessionState.ts";

const css = readFileSync(join(import.meta.dir, "..", "src", "ui", "styles.css"), "utf8");

test("the tab strip's CSS height equals DOCK_TABS_HEIGHT", () => {
  const rule = css.match(/^\.dock-bar \{([^}]*)\}/m);
  expect(rule).not.toBeNull();
  const height = rule?.[1].match(/(?:^|;)\s*height:\s*(\d+)px/);
  expect(height).not.toBeNull();
  expect(Number(height?.[1])).toBe(DOCK_TABS_HEIGHT);
});
