// Agent profiles (design.md D16): an agent is a command line plus opening prompts. Nothing here knows any vendor.
import { DEFAULT_SHIP_PROMPT, type AgentAvailability, type AgentProfile, type Config, type RepoConfig, type SessionAction } from "../../shared/types.ts";
import { CHANGE_NAME } from "../source.ts";

export function agentFor(config: Config, repo: RepoConfig): AgentProfile | undefined {
  const agents = config.agentSessions.agents;
  return agents.find((a) => a.id === repo.agent?.agentId) ?? agents.find((a) => a.id === config.agentSessions.defaultAgent);
}

export function availability(config: Config): AgentAvailability[] {
  return config.agentSessions.agents.map((agent) => {
    const path = Bun.which(agent.command[0]) ?? undefined;
    return { id: agent.id, name: agent.name, available: path !== undefined, path };
  });
}

/** The opening prompt for a starter, or undefined when this agent has none (the starter is then not offered). */
export function openingPrompt(agent: AgentProfile, action: SessionAction, change: string): string | undefined {
  const template = agent.prompts[action];
  if (!template) return undefined;
  if (!CHANGE_NAME.test(change)) throw new Error("invalid change name");
  return template.replaceAll("{change}", change);
}

/** Every agent can ship: a profile without its own Ship prompt gets the agent-neutral default. */
export function shipPrompt(agent: AgentProfile, change: string): string {
  if (!CHANGE_NAME.test(change)) throw new Error("invalid change name");
  return (agent.prompts.ship ?? DEFAULT_SHIP_PROMPT).replaceAll("{change}", change);
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

export function agentEnv(agent: AgentProfile, base: Record<string, string | undefined>): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(base)) {
    if (value !== undefined && !agent.unsetEnv?.includes(key)) env[key] = value;
  }
  env.TERM = "xterm-256color";
  env.COLORTERM = "truecolor";
  return env;
}
