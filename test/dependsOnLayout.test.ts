// Each **Depends on** choice in the New change form is one row: checkbox, name, column. Its label sits inside
// `.new-change`, whose form-wide `label` rule stacks caption above input with `flex-direction: column`; the Depends on
// rule must override the direction as well as the display, or the name and the column stack beside the checkbox.
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const css = readFileSync(join(import.meta.dir, "..", "src", "ui", "styles.css"), "utf8");

/** The value `property` has in the first rule whose selector list is exactly `selector`. */
function declared(selector: string, property: string): string | undefined {
  const match = css.match(new RegExp(`(?:^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`));
  if (!match) throw new Error(`no rule for ${selector} in styles.css`);
  return match[1].match(new RegExp(`(?:^|;)\\s*${property}:\\s*([^;]*)`))?.[1]?.trim();
}

test("a Depends on choice keeps its checkbox, name and column on one line", () => {
  // The form-wide rule this one has to override.
  expect(declared(".new-change label", "flex-direction")).toBe("column");

  expect(declared(".new-change .new-change-depends label", "display")).toBe("flex");
  expect(declared(".new-change .new-change-depends label", "flex-direction")).toBe("row");
  expect(declared(".new-change .new-change-depends label", "min-width")).toBe("0");
  // The checkbox stays on the name's first line and never shrinks when a long name wraps.
  expect(declared(".new-change-depends li", "align-items")).toBe("baseline");
  expect(declared(".new-change-depends li input", "flex")).toBe("none");
});
