import { expect, test } from "bun:test";
import type { ArtifactStatus } from "../src/shared/types.ts";
import { cardProgress, meterText } from "../src/ui/kanban.tsx";

const A = (...done: boolean[]): ArtifactStatus[] => ["proposal", "specs", "design", "tasks"].map((id, i) => ({ id, status: done[i] ? "done" : "ready" }));

test("a Drafts card counts written artifacts, whatever the tasks say", () => {
  expect(cardProgress({ stage: "drafts", artifacts: A(true, false, true, false), tasks: { done: 0, total: 12 } })).toEqual({ done: 2, total: 4, unit: "artifacts" });
  expect(meterText(2, 4, "artifacts")).toBe("2 of 4 artifacts written");
  const brief: ArtifactStatus[] = [{ id: "brief", status: "done" }, { id: "plan", status: "ready" }, { id: "checklist", status: "blocked" }];
  expect(cardProgress({ stage: "drafts", artifacts: brief, tasks: null })).toEqual({ done: 1, total: 3, unit: "artifacts" });
});

test("other cards count tasks when there are any; Backlog shows no bar", () => {
  expect(cardProgress({ stage: "ready", artifacts: A(true, true, true, true), tasks: { done: 0, total: 12 } })).toEqual({ done: 0, total: 12, unit: "tasks" });
  expect(meterText(0, 12, "tasks")).toBe("0 of 12 tasks complete");
  expect(cardProgress({ stage: "implementing", artifacts: A(true, true, true, true), tasks: { done: 3, total: 12 } })?.unit).toBe("tasks");
  expect(cardProgress({ stage: "ready", artifacts: A(true, true, true, true), tasks: { done: 0, total: 0 } })).toBeUndefined();
  expect(cardProgress({ stage: "backlog", artifacts: A(false, false, false, false), tasks: { done: 0, total: 0 } })).toBeUndefined();
  expect(cardProgress({ stage: "backlog", artifacts: A(false, false, false, false), tasks: null })).toBeUndefined();
});
