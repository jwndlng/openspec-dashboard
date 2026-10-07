// The projects table's row content stays in its cells (project-overview: "Table rows keep their content inside their
// own cells"). Layout cannot be measured without a browser, so these guard the two rules that broke it.
import { expect, test } from "bun:test";

async function rules(): Promise<{ selector: string; body: string }[]> {
  const css = (await Bun.file(new URL("../src/ui/styles.css", import.meta.url)).text()).replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ selector: m[1].trim(), body: m[2] }));
}

test("every .agent-toggle rule is scoped to the profile card header or to the overview's control", async () => {
  const selectors = (await rules())
    .flatMap((r) => r.selector.split(","))
    .map((s) => s.trim())
    .filter((s) => s.includes(".agent-toggle"));
  expect(selectors.length).toBeGreaterThan(0);
  for (const s of selectors) {
    expect(s.includes(".agent-card-head .agent-toggle") || s.includes(".control.agent-toggle")).toBe(true);
  }
});

test("a table row's label chips do not wrap", async () => {
  const rule = (await rules()).find((r) => r.selector === ".projects .repo-name .label-chips");
  expect(rule?.body).toContain("flex-wrap: nowrap");
});
