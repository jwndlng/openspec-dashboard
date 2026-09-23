import { expect, test } from "bun:test";
import { columnKind, promptBody } from "../src/ui/boardMarks.ts";

test("column markers follow the lifecycle", () => {
  const kinds = ["New", "Proposal", "Design", "Specs", "Ready", "Implementing", "Done", "Synced", "Archived", "Unknown"].map(columnKind);
  expect(kinds).toEqual(["neutral", "neutral", "neutral", "neutral", "accent", "accent", "success", "success", "muted", "warning"]);
  // Another schema's artifact columns are neutral too.
  expect(columnKind("Brief")).toBe("neutral");
});

test("the detail view shows the prompt without the heading the create form writes", () => {
  expect(promptBody("# Prompt\n\nLog every mutation\nand keep it for a year\n")).toBe("Log every mutation\nand keep it for a year");
  expect(promptBody("  \n\n  Rotate keys weekly  ")).toBe("Rotate keys weekly");
  expect(promptBody("# Prompt\n\n   \n")).toBeUndefined();
  expect(promptBody(undefined)).toBeUndefined();
});
