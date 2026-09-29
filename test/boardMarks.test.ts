import { expect, test } from "bun:test";
import { columnKind, promptBody } from "../src/ui/boardMarks.ts";
import { ChangeCard, type Card } from "../src/ui/kanban.tsx";
import { byTag, textOf } from "./vnode.ts";

test("column markers follow the lifecycle", () => {
  const kinds = ["Backlog", "Drafts", "Ready", "Implementing", "Done", "Archived", "Unknown"].map(columnKind);
  expect(kinds).toEqual(["neutral", "neutral", "accent", "accent", "success", "muted", "warning"]);
});

test("the detail view shows the prompt without the heading the create form writes", () => {
  expect(promptBody("# Prompt\n\nLog every mutation\nand keep it for a year\n")).toBe("Log every mutation\nand keep it for a year");
  expect(promptBody("  \n\n  Rotate keys weekly  ")).toBe("Rotate keys weekly");
  expect(promptBody("# Prompt\n\n   \n")).toBeUndefined();
  expect(promptBody(undefined)).toBeUndefined();
});

const card = (patch: Partial<Card>): Card => ({
  repoId: "r", repoName: "demo-ops", repoPath: "/w/acme/demo-ops", hue: 0,
  name: "confirm-retention", schema: "spec-driven",
  artifacts: ["proposal", "specs", "design", "tasks"].map((id) => ({ id, status: "done" as const })),
  tasks: { done: 13, awaiting: 2, total: 15 }, stage: "done", column: "Done", subState: "validate",
  ...patch,
});
const badges = (node: Card) => byTag(ChangeCard({ card: node, now: Date.parse("2026-09-29T12:00:00Z"), from: "" }), "span").filter((b) => String(b.props.class ?? "").startsWith("badge"));

test("a card whose change awaits validation shows the Validate badge, in the warning role", () => {
  const marks = badges(card({}));
  expect(marks.map((b) => [b.props.class, textOf(b)])).toContainEqual(["badge warning", "Validate"]);
  expect(marks.find((b) => textOf(b) === "Validate")?.props.title).toBe("2 tasks await your confirmation");
  const one = badges(card({ tasks: { done: 14, awaiting: 1, total: 15 } }));
  expect(one.find((b) => textOf(b) === "Validate")?.props.title).toBe("1 task awaits your confirmation");
});

test("no Validate badge without awaiting tasks, and never on an archived change", () => {
  expect(badges(card({ tasks: { done: 15, awaiting: 0, total: 15 } })).map(textOf)).not.toContain("Validate");
  // A snapshot cached before `awaiting` existed has none either.
  expect(badges(card({ tasks: { done: 15, total: 15 } })).map(textOf)).not.toContain("Validate");
  expect(badges(card({ archived: "2026-06-18", stage: "archived", column: "Archived", subState: undefined })).map(textOf)).not.toContain("Validate");
  // The column marker of `Done` stays `success`: the column as a whole is still the done column.
  expect(columnKind("Done")).toBe("success");
});
