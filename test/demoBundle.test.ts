// Builds both bundles and checks what is in them: the demo must be fictional, the product must be demo-free.
import { beforeAll, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSample, DEMO_MARKER } from "../src/ui/demo/sampleData.ts";
import { looksLikeRealHome } from "./helpers.ts";

const root = join(import.meta.dir, "..");
const read = (target: string) => readFileSync(join(root, "dist", target, "index.html"), "utf8");
const sampleNames = buildSample(0).snapshot.repos.map((r) => r.name);

beforeAll(async () => {
  for (const args of [[], ["demo"]]) {
    const build = Bun.spawn(["bun", "run", join(root, "scripts", "build-ui.ts"), ...args], { cwd: root, stdout: "ignore", stderr: "inherit" });
    expect(await build.exited).toBe(0);
  }
});

/** The inlined fonts are base64 and can contain anything; they are not data. */
function withoutFonts(html: string): string {
  return html.replace(/url\(data:font\/woff2;base64,[^)]*\)/g, "url()");
}

test("the demo bundle is marked, self-contained and free of real-looking paths", () => {
  const html = withoutFonts(read("demo"));
  expect(html).toContain(DEMO_MARKER);
  for (const name of sampleNames) expect(html).toContain(name);
  expect(html.match(/[^\n]{0,40}(?:\/Users\/|[A-Za-z]:\\+Users\\)[^\n]{0,40}/g) ?? []).toEqual([]);
  expect(looksLikeRealHome(html)).toBe(false);
  expect(html).not.toMatch(/<script[^>]+src=|<link[^>]+href=/);
});

test("the product bundle contains neither the demo marker nor the sample data", () => {
  const html = read("ui");
  expect(html).not.toContain(DEMO_MARKER);
  for (const name of sampleNames) expect(html).not.toContain(name);
  expect(html).not.toContain("/home/demo");
});
