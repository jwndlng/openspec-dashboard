import { expect, test } from "bun:test";
import { AGENT_PRESETS, ANTIGRAVITY_PROFILE, CLAUDE_PROFILE } from "../src/shared/agentDefaults.ts";
import type { AgentAvailability, AgentProfile, PromptKey } from "../src/shared/types.ts";
import { AgentEditor, PresetPicker } from "../src/ui/agentSettings.tsx";
import { byTag, elements, textOf } from "./vnode.ts";

const profile = (patch: Partial<AgentProfile> = {}): AgentProfile => ({ id: "fake", name: "Fake Agent", command: ["fake", "{prompt}"], prompts: { implement: "implement {change}" }, ...patch });

/** Every additional-instructions control, in the order the editor lays them out. */
function suffixFields(agent: AgentProfile) {
  let patch: Partial<AgentProfile> | undefined;
  const tree = AgentEditor({ agent, isDefault: true, canRemove: false, onChange: (p) => (patch = p), onRemove: () => {}, onDefault: () => {} });
  const fields = elements(tree).filter((el) => (el.type === "input" || el.type === "textarea") && el.props.placeholder === "nothing is appended");
  const type = (index: number, value: string) => {
    (fields[index].props.onInput as (e: { currentTarget: { value: string } }) => void)({ currentTarget: { value } });
    return patch;
  };
  return { fields, type, tree };
}

const KEYS: PromptKey[] = ["draft", "implement", "validate", "archive", "ship", "resolveConflicts", "integrate"];

test("the editor offers additional instructions beside every prompt, and shows what is saved", () => {
  const { fields, tree } = suffixFields(profile({ promptSuffixes: { implement: "Run the linter.", ship: "Add the checklist." } }));
  // One per prompt: the four starters, Ship, Resolve conflicts and Integrate.
  expect(fields).toHaveLength(KEYS.length);
  expect(fields.filter((f) => f.type === "textarea")).toHaveLength(3); // Ship, Resolve conflicts and Integrate keep their textareas
  expect(fields.map((f) => f.props.value)).toEqual(["", "Run the linter.", "", "", "Add the checklist.", "", ""]);

  // Each field says what it does, so the one-line rule and the placeholder rules are not a surprise.
  const hints = textOf(tree);
  expect(hints).toContain("Additional Implement instructions");
  expect(hints).toContain("as one line");
  expect(hints).toContain("this text alone does not offer the starter");
  expect(hints).toContain("or to the default shown there"); // Ship works without a prompt of its own
  expect(hints).toContain("no placeholder at all"); // Integrate
});

test("typing stores the text under its own key; clearing a field removes it", () => {
  const { type } = suffixFields(profile({ promptSuffixes: { implement: "Run the linter." } }));
  // A new key is added beside the one already saved.
  expect(type(KEYS.indexOf("archive"), "Tell me what you archived.")?.promptSuffixes).toEqual({ implement: "Run the linter.", archive: "Tell me what you archived." });
  // Blank is nothing to append, so the key goes rather than being saved as whitespace.
  expect(type(KEYS.indexOf("implement"), "   ")?.promptSuffixes).toBeUndefined();
  expect(type(KEYS.indexOf("implement"), "")?.promptSuffixes).toBeUndefined();

  // With another key still set, only the cleared one goes.
  const two = suffixFields(profile({ promptSuffixes: { implement: "Run the linter.", ship: "Add the checklist." } }));
  expect(two.type(KEYS.indexOf("ship"), "")?.promptSuffixes).toEqual({ implement: "Run the linter." });
  expect(two.type(KEYS.indexOf("integrate"), "Ask me first.")?.promptSuffixes).toEqual({ implement: "Run the linter.", ship: "Add the checklist.", integrate: "Ask me first." });
});

test("Agent sessions settings point to Projects for the per-project switch and agent, and list no repository", async () => {
  const { PerProjectNote } = await import("../src/ui/agentSettings.tsx");
  const { byTag } = await import("./vnode.ts");
  const note = PerProjectNote();
  expect(textOf(note)).toContain("set them on Projects");
  expect(byTag(note, "a")[0].props.href).toBe("/");
  expect(byTag(note, "input")).toHaveLength(0);
  const source = await Bun.file(new URL("../src/ui/agentSettings.tsx", import.meta.url)).text();
  expect(source).not.toContain("draft.repos");
});

/** The preset buttons as `[label, mark]`, in the order they are shown, and a way to click one. */
function picker(agents: AgentProfile[], presets?: AgentAvailability[]) {
  const added: AgentProfile[] = [];
  const buttons = byTag(PresetPicker({ agents, presets, onAdd: (p) => added.push(p) }), "button");
  const rows = buttons.map((b) => {
    const text = textOf(b).replace(/\s+/g, " ").trim();
    return [text.replace(/ (✓ found|⚠ not found)$/, ""), text.match(/(✓ found|⚠ not found)$/)?.[1] ?? ""];
  });
  const click = (label: string) => (buttons[rows.findIndex(([l]) => l === label)].props.onClick as () => void)();
  return { rows, click, added };
}

test("the preset picker offers the unconfigured presets, found ones first, each marked", () => {
  const presets: AgentAvailability[] = [
    { id: "codex", name: "Codex", available: false },
    { id: "agy", name: "Antigravity", available: true, path: "/usr/local/bin/agy" },
  ];
  const { rows, click, added } = picker([structuredClone(CLAUDE_PROFILE)], presets);
  expect(rows).toEqual([
    ["+ Antigravity preset", "✓ found"],
    ["+ Codex preset", "⚠ not found"],
  ]);
  // Adding copies the preset: equal to it, but the user's to edit without touching the preset itself.
  click("+ Antigravity preset");
  expect(added).toEqual([ANTIGRAVITY_PROFILE]);
  expect(added[0]).not.toBe(ANTIGRAVITY_PROFILE);
  added[0].prompts.implement = "edited {change}";
  expect(ANTIGRAVITY_PROFILE.prompts.implement).not.toBe("edited {change}");
});

test("a configured preset is not offered again, edited or not; a removed one is", () => {
  const editedAgy = { ...structuredClone(ANTIGRAVITY_PROFILE), name: "My agy", command: ["agy", "{prompt}"] };
  expect(picker([structuredClone(CLAUDE_PROFILE), editedAgy]).rows.map(([l]) => l)).toEqual(["+ Codex preset"]);
  // Without the Claude Code profile it is offered again, in preset order while nothing is found.
  const none: AgentAvailability[] = [
    { id: "claude", name: "Claude Code", available: false },
    { id: "codex", name: "Codex", available: false },
  ];
  expect(picker([editedAgy], none).rows).toEqual([
    ["+ Claude Code preset", "⚠ not found"],
    ["+ Codex preset", "⚠ not found"],
  ]);
});

test("before availability has loaded every preset is offered, unmarked, in preset order", () => {
  expect(picker([{ id: "fake", name: "Fake", command: ["fake", "{prompt}"], prompts: {} }]).rows).toEqual([
    ["+ Claude Code preset", ""],
    ["+ Codex preset", ""],
    ["+ Antigravity preset", ""],
  ]);
  expect(picker(AGENT_PRESETS.map((p) => structuredClone(p.profile))).rows).toEqual([]);
});
