import { expect, test } from "bun:test";
import { inPlaceLeftover, inPlaceReason } from "../src/ui/inPlaceText.ts";

test("a git repository with no commit is never called 'not a git repository'", () => {
  const reason = inPlaceReason("/w/acme/fresh-app", true);
  expect(reason).toContain("/w/acme/fresh-app");
  expect(reason).toContain("no commit yet");
  expect(reason).toContain("no undo");
  expect(reason).not.toContain("not a git repository");
  expect(inPlaceLeftover(true)).not.toContain("not a git repository");
});

test("a folder without git keeps its wording", () => {
  expect(inPlaceReason("/w/acme/plain", false)).toBe("/w/acme/plain is not a git repository, so the agent works in the folder itself. There is no branch, no commit and no undo.");
  expect(inPlaceLeftover(false)).toContain("not a git repository");
});
