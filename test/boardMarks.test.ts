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

test("a card is marked live only when told it is working, and its name still reads in full", () => {
  const frame = (working?: { tinted: boolean; sweeping: boolean }) => byTag(ChangeCard({ card: card({}), now: Date.parse("2026-09-29T12:00:00Z"), from: "", working }), "article")[0];
  const live = { tinted: true, sweeping: true };
  expect(frame(live).props.class).toBe("card live");
  // Tinted without motion: a pull request that only waits.
  expect(frame({ tinted: true, sweeping: false }).props.class).toBe("card live pr-waiting");
  expect(frame({ tinted: false, sweeping: false }).props.class).toBe("card");
  expect(frame().props.class).toBe("card");
  const name = byTag(frame(live), "span").find((s) => s.props.class === "name");
  expect(name && textOf(name)).toBe("confirm-retention");
});

const notes = (node: Card, running = false) =>
  byTag(ChangeCard({ card: node, now: Date.parse("2026-09-29T12:00:00Z"), from: "", running }), "span").filter((s) => s.props.class === "waits-for");
const blockedReady = card({
  stage: "ready", column: "Ready", subState: undefined, tasks: { done: 0, total: 12 }, blocked: true,
  dependsOn: [
    { name: "add-billing-schema", state: "met" },
    { name: "add-billing-api", state: "waiting" },
    { name: "add-billing-scheme", state: "missing" },
  ],
});

test("a blocked card in Ready waits instead of offering Implement, naming what it waits for", () => {
  const [note] = notes(blockedReady);
  expect(textOf(note)).toBe("⧗ waits for add-billing-api +1");
  expect(note.props.title).toBe("Implement is held back until these are done or archived in the main checkout: add-billing-api — waiting, add-billing-scheme — missing");
  expect(note.props["aria-label"]).toBe(note.props.title);
  // A note, not a control.
  expect(byTag(ChangeCard({ card: blockedReady, now: 0, from: "" }), "button")).toEqual([]);
  expect(notes({ ...blockedReady, stage: "implementing", column: "Implementing" })).toHaveLength(1);
  expect(textOf(notes({ ...blockedReady, dependsOn: undefined })[0])).toContain("depends-on.yaml unreadable");
});

test("no note while drafting, once unblocked, or while a session runs", () => {
  expect(notes({ ...blockedReady, stage: "drafts", column: "Drafts" })).toEqual([]);
  expect(notes({ ...blockedReady, blocked: undefined })).toEqual([]);
  expect(notes(blockedReady, true)).toEqual([]);
});
