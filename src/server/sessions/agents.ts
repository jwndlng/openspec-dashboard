// Agent profiles (design.md D16): an agent is a command line plus opening prompts. Nothing here knows any vendor.
import { AUTO_MERGE_DOCS_INSTRUCTION, DEFAULT_INTEGRATE_PROMPT, DEFAULT_RESOLVE_CONFLICTS_PROMPT, DEFAULT_SHIP_PROMPT, type AgentAvailability, type AgentProfile, type Config, type PromptKey, type RepoConfig, type SessionAction } from "../../shared/types.ts";
import { AGENT_PRESETS } from "../../shared/agentDefaults.ts";
import { whichOnPath } from "../paths.ts";
import { CHANGE_NAME } from "../source.ts";

export function agentFor(config: Config, repo: RepoConfig): AgentProfile | undefined {
  const agents = config.agentSessions.agents;
  return agents.find((a) => a.id === repo.agent?.agentId) ?? agents.find((a) => a.id === config.agentSessions.defaultAgent);
}

export function availability(config: Config): AgentAvailability[] {
  return config.agentSessions.agents.map((agent) => {
    const path = whichOnPath(agent.command[0]);
    return { id: agent.id, name: agent.name, available: path !== undefined, path };
  });
}

/**
 * Whether the executable of each preset that is not configured yet is on this machine, so Settings can list the found
 * ones first. A hint for the user's choice only: nothing is ever added because it was found. The presets are data.
 */
export function presetAvailability(config: Config): AgentAvailability[] {
  const configured = new Set(config.agentSessions.agents.map((a) => a.id));
  return AGENT_PRESETS.filter(({ profile }) => !configured.has(profile.id)).map(({ profile }) => {
    const path = whichOnPath(profile.command[0]);
    return { id: profile.id, name: profile.name, available: path !== undefined, path };
  });
}

/**
 * A prompt plus the profile's additional instructions for the same key. One line, always: a prompt may be typed into a
 * terminal, where a line break would submit it early, so whitespace in the suffix is collapsed before it is appended.
 */
function compose(agent: AgentProfile, key: PromptKey, prompt: string): string {
  const suffix = agent.promptSuffixes?.[key]?.trim().replace(/\s+/g, " ");
  return suffix ? `${prompt} ${suffix}` : prompt;
}

/** The opening prompt for a starter, or undefined when this agent has none (the starter is then not offered). */
export function openingPrompt(agent: AgentProfile, action: SessionAction, change: string): string | undefined {
  const template = agent.prompts[action];
  // Checked before the suffix: additional instructions are an addition, never a prompt of their own, so they never make
  // a starter available (agent-sessions spec).
  if (!template) return undefined;
  if (!CHANGE_NAME.test(change)) throw new Error("invalid change name");
  return compose(agent, action, template).replaceAll("{change}", change);
}

/**
 * Every agent can ship: a profile without its own Ship prompt gets the agent-neutral default — suffix and all. With
 * `autoMerge` (the project opted in and the session ships only OpenSpec documents) the fixed auto-merge instruction
 * comes last, after the suffix, so nothing in the profile can follow and undo it.
 */
export function shipPrompt(agent: AgentProfile, change: string, { autoMerge = false }: { autoMerge?: boolean } = {}): string {
  if (!CHANGE_NAME.test(change)) throw new Error("invalid change name");
  const prompt = compose(agent, "ship", agent.prompts.ship ?? DEFAULT_SHIP_PROMPT).replaceAll("{change}", change);
  return autoMerge ? `${prompt} ${AUTO_MERGE_DOCS_INSTRUCTION}` : prompt;
}

/**
 * Like Ship: every agent can integrate, configured for it or not — suffix and all. Nothing is substituted into it: the
 * repository folder is the agent's working directory, so no text from the browser reaches its command line.
 */
export function integratePrompt(agent: AgentProfile): string {
  return compose(agent, "integrate", agent.prompts.integrate ?? DEFAULT_INTEGRATE_PROMPT);
}

/** Like Ship: every agent can be asked to resolve conflicts, configured for it or not — suffix and all. */
export function resolveConflictsPrompt(agent: AgentProfile, change: string): string {
  if (!CHANGE_NAME.test(change)) throw new Error("invalid change name");
  return compose(agent, "resolveConflicts", agent.prompts.resolveConflicts ?? DEFAULT_RESOLVE_CONFLICTS_PROMPT).replaceAll("{change}", change);
}

export interface Launch {
  argv: string[];
  /** Set when the command has no `{prompt}` argument: the prompt is typed into the terminal after start-up. */
  typed?: string;
}

/** Argument list for the agent. The prompt only ever becomes one whole argument or terminal input — never shell text. */
export function launchCommand(agent: AgentProfile, prompt: string): Launch {
  if (!agent.command.some((arg) => arg.includes("{prompt}"))) return { argv: [...agent.command], typed: prompt };
  return { argv: agent.command.map((arg) => (arg === "{prompt}" ? prompt : arg.replaceAll("{prompt}", prompt))) };
}

/** The main console's agent: the default profile, whatever repository settings say. */
export function defaultAgentOf(config: Config): AgentProfile | undefined {
  return config.agentSessions.agents.find((a) => a.id === config.agentSessions.defaultAgent);
}

/** The console has no opening prompt: every argument that would carry one is left out, and nothing is typed. */
export function launchWithoutPrompt(agent: AgentProfile): string[] {
  return agent.command.filter((arg) => !arg.includes("{prompt}"));
}

export function agentEnv(agent: AgentProfile, base: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !agent.unsetEnv?.includes(key)) env[key] = value;
  }
  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  return env;
}
