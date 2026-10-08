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

// repository-pull: the overview's Pull is bordered at rest and as tall as the Console button beside it.
test("the overview's Pull shares the bordered rule of the project Console button and is never a ghost", async () => {
  const all = await rules();
  const rule = all.find((r) => r.selector.split(",").map((s) => s.trim()).includes(".pull-btn.on-overview"));
  expect(rule?.selector).toContain(".project-console-btn.on-project");
  expect(rule?.body).toContain("border-color: var(--border-strong)");
  expect(rule?.body).toContain("height: 24px");
  const source = await Bun.file(new URL("../src/ui/pull.tsx", import.meta.url)).text();
  const pullClass = source.match(/class=\{`btn sm pull-btn[^`]*`\}/)?.[0];
  expect(pullClass).toBeDefined();
  expect(pullClass).not.toContain("ghost");
});

// project-overview: the settings button sits at the right edge of a row's actions, lined up across rows. A rule scoped
// to the table must right-align the cell, or `.projects td` (one class and one element) left-aligns it again.
test("the table's actions cell is right-aligned by a rule that outranks the table's cell alignment", async () => {
  const rule = (await rules()).find((r) => r.selector === ".projects .row-actions");
  expect(rule?.body).toContain("text-align: right");
});
