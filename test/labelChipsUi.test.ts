// Label colours on the overview and the board (project-labels: "Labels are shown in a label colour").
import { expect, test } from "bun:test";
import type { ComponentChildren } from "preact";
import { labelHue } from "../src/shared/labels.ts";
import type { Config, RepoSnapshot } from "../src/shared/types.ts";
import { IconCheck, IconScan } from "../src/ui/icons.tsx";
import { LabelChips } from "../src/ui/labels.tsx";
import { Row, Tile } from "../src/ui/overview.tsx";
import { overviewRows } from "../src/ui/overviewState.ts";
import type { Tracking } from "../src/ui/untracked.tsx";
import { elements } from "./vnode.ts";

const repo = (id: string, name: string, detected: string[] = []): RepoSnapshot => ({
  id,
  name,
  path: `/w/acme/${name}`,
  ok: true,
  scannedAt: "2026-10-01T00:00:00Z",
  isGit: true,
  worktrees: [],
  changes: [],
  detectedLabels: detected.map((label) => ({ label, marker: "`go.mod`" })),
});
const config = {
  repos: [
    { id: "a", path: "/w/acme/alpha-infra", name: "alpha-infra", enabled: true, labels: ["client"] },
    { id: "b", path: "/w/acme/beta-soc", name: "beta-soc", enabled: true, labels: ["Client"] },
  ],
  labelColors: { go: 290 },
} as unknown as Config;
const rows = overviewRows({ generatedAt: "2026-10-01T00:00:00Z", repos: [repo("a", "alpha-infra", ["go"]), repo("b", "beta-soc")] }, config);
const tracking = { busy: {}, errors: {} } as unknown as Tracking;

/** The label chips a hook-free component renders. */
const chipsOf = (node: ComponentChildren) => elements(node).filter((e) => /(^| )label-chip( |$)/.test(String(e.props.class ?? "")));
/** An icon's drawing, to tell which icon a chip holds once the walk has expanded it into plain SVG. */
const drawing = (node: ComponentChildren) => JSON.stringify(elements(node).map((e) => [e.type, e.props.d, e.props.points]));
const holds = (chip: { props: { children?: ComponentChildren } }, icon: ComponentChildren) => drawing(chip.props.children).includes(drawing(icon).slice(1, -1));
const hueOf = (chip: { props: Record<string, unknown> }) => (chip.props.style as Record<string, string>)["--label-hue"];

test("a label wears the same colour on every row and tile, ignoring case, and a chosen colour wins", () => {
  const rowChips = [...chipsOf(Row({ row: rows[0], now: 0, tracking })), ...chipsOf(Row({ row: rows[1], now: 0, tracking }))];
  const tileChips = [...chipsOf(Tile({ row: rows[0], now: 0, tracking })), ...chipsOf(Tile({ row: rows[1], now: 0, tracking }))];
  const client = [...rowChips, ...tileChips].filter((c) => String(c.props.title).startsWith("Your label"));
  expect(client).toHaveLength(4);
  expect(new Set(client.map(hueOf))).toEqual(new Set([String(labelHue("client", undefined))]));
  for (const chip of [...rowChips, ...tileChips]) expect(String(chip.props.class)).toContain("label-tint");
  const go = rowChips.find((c) => String(c.props.class).includes("detected"));
  expect(go && hueOf(go)).toBe("290");
});

test("only an active filter chip shows the check mark; a detected chip keeps its icon", () => {
  const chips = chipsOf(LabelChips({ labels: rows[0].labels, isActive: (l) => l === "client", onToggle: () => {} }));
  expect(chips.map((c) => c.type)).toEqual(["button", "button"]);
  const [client, go] = chips;
  expect(client.props["aria-pressed"]).toBe(true);
  expect(String(client.props.class)).toContain(" on");
  expect(holds(client, IconCheck({ size: 11 }))).toBe(true);
  expect(go.props["aria-pressed"]).toBe(false);
  expect(holds(go, IconCheck({ size: 11 }))).toBe(false);
  expect(holds(go, IconScan({ size: 11 }))).toBe(true);
});
