import { expect, test } from "bun:test";
import { defaultAgentSessions, defaultConfig, newRepoConfig } from "../src/server/config.ts";
import type { Config } from "../src/shared/types.ts";
import { NoRepos } from "../src/ui/empty.tsx";
import { NewProjectButton, NewProjectTrigger } from "../src/ui/newProject.tsx";
import { byComponent, byTag, textOf } from "./vnode.ts";

const config = (patch: Partial<Config> = {}): Config => ({ ...defaultConfig(), scanRoots: ["/w/acme"], agentSessions: { ...defaultAgentSessions(), enabled: true }, ...patch });

test("an available New project button is active and named plainly", () => {
  const button = byTag(NewProjectTrigger({ off: undefined, small: true, onOpen: () => {} }), "button")[0];
  expect(button.props.disabled).toBe(false);
  expect(button.props["aria-label"]).toBe("New project");
  expect(textOf(button)).toContain("New project");
});

test("an unavailable New project button is inactive and says why, in its tooltip and its accessible name", () => {
  const button = byTag(NewProjectTrigger({ off: "agent sessions are disabled", small: true, onOpen: () => {} }), "button")[0];
  expect(button.props.disabled).toBe(true);
  expect(button.props.title).toBe("New project is unavailable: agent sessions are disabled");
  expect(button.props["aria-label"]).toBe("New project, unavailable: agent sessions are disabled");
});

test("the empty state offers New project next to its link to Settings while nothing is tracked", () => {
  const empty = NoRepos({ config: config() });
  expect(textOf(empty)).toContain("Open Settings");
  const offered = byComponent(empty, NewProjectButton);
  expect(offered).toHaveLength(1);
  expect(offered[0].props.small).toBe(false);
});

test("while the first scan runs the empty state offers nothing", () => {
  const scanning = NoRepos({ config: config({ repos: [newRepoConfig("/w/acme/demo-ops", true)] }) });
  expect(byComponent(scanning, NewProjectButton)).toEqual([]);
});
