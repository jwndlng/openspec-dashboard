import { expect, test } from "bun:test";
import type { AgentProfile, PromptKey } from "../src/shared/types.ts";
import { AgentEditor } from "../src/ui/agentSettings.tsx";
import { elements, textOf } from "./vnode.ts";

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
