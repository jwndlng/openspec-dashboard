// Settings section for agent sessions. Off by default; turning it on lets you start an agent CLI in a terminal for a
// change, so the section says plainly what that means. An agent is just a command line and its opening prompts.
import { useEffect, useState } from "preact/hooks";
import { CLAUDE_PROFILE } from "../shared/agentDefaults.ts";
import { DEFAULT_SHIP_PROMPT, repoAgentEnabled, SESSION_ACTIONS, type AgentAvailability, type AgentProfile, type AgentSessionsConfig, type Config, type RepoConfig, type Session, type SessionAction } from "../shared/types.ts";
import { api } from "./api.ts";
import { parseArgLines, slugId } from "./sessionState.ts";

interface Props {
  draft: Config;
  update: (patch: Partial<Config>) => void;
}

const ACTION_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", archive: "Archive" };

function AgentEditor({ agent, found, isDefault, canRemove, onChange, onRemove, onDefault }: { agent: AgentProfile; found?: AgentAvailability; isDefault: boolean; canRemove: boolean; onChange: (patch: Partial<AgentProfile>) => void; onRemove: () => void; onDefault: () => void }) {
  return (
    <details class="agent-card" open={isDefault}>
      <summary>
        <strong>{agent.name}</strong> <code>{agent.command[0]}</code>
        {isDefault && <span class="badge">default</span>}
        {found && (found.available ? <span class="badge success" title={found.path}>✓ found</span> : <span class="badge danger">⚠ not found on this machine</span>)}
      </summary>
      <div class="agent-fields">
        <label class="check grow">
          Name
          <input class="input grow" value={agent.name} onInput={(e) => onChange({ name: e.currentTarget.value })} />
        </label>
        <label class="agent-tools">
          <span class="hint">
            Command, <strong>one argument per line</strong> (no shell). <code>{"{prompt}"}</code> becomes the opening prompt as one argument; without it the prompt is typed into
            the terminal after start.
          </span>
          <textarea class="input mono" rows={Math.max(2, agent.command.length)} value={agent.command.join("\n")} onInput={(e) => onChange({ command: parseArgLines(e.currentTarget.value) })} />
        </label>
        {SESSION_ACTIONS.map((action) => (
          <label class="check grow" key={action}>
            {ACTION_LABEL[action]}
            <input
              class="input mono grow"
              placeholder="no prompt — this starter is not offered"
              value={agent.prompts[action] ?? ""}
              onInput={(e) => {
                const prompts = { ...agent.prompts };
                const value = e.currentTarget.value;
                if (value.trim()) prompts[action] = value;
                else delete prompts[action];
                onChange({ prompts });
              }}
            />
          </label>
        ))}
        <label class="agent-tools">
          <span class="hint">
            Ship prompt (optional): what the <strong>Ship</strong> button asks this agent, to get a session's work committed, pushed and into a pull request. Empty uses the default
            shown; <code>{"{change}"}</code> may be used.
          </span>
          <textarea
            class="input mono"
            rows={3}
            placeholder={DEFAULT_SHIP_PROMPT}
            value={agent.prompts.ship ?? ""}
            onInput={(e) => {
              const prompts = { ...agent.prompts };
              const value = e.currentTarget.value;
              if (value.trim()) prompts.ship = value;
              else delete prompts.ship;
              onChange({ prompts });
            }}
          />
        </label>
        <label class="agent-tools">
          <span class="hint">Resume command (optional, one argument per line): continues the agent's latest conversation in the same worktree.</span>
          <textarea class="input mono" rows={2} value={(agent.resumeCommand ?? []).join("\n")} onInput={(e) => onChange({ resumeCommand: parseArgLines(e.currentTarget.value).length ? parseArgLines(e.currentTarget.value) : undefined })} />
        </label>
        <div class="row">
          {!isDefault && (
            <button type="button" class="btn sm" onClick={onDefault}>
              Make default
            </button>
          )}
          {canRemove && (
            <button type="button" class="btn sm ghost" onClick={onRemove}>
              Remove agent
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

export function AgentSettings({ draft, update }: Props) {
  const [found, setFound] = useState<AgentAvailability[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    api
      .sessions()
      .then((r) => {
        setFound(r.agents);
        setSessions(r.sessions);
      })
      .catch(() => undefined);
  }, []);

  const settings = draft.agentSessions;
  const set = (patch: Partial<AgentSessionsConfig>) => update({ agentSessions: { ...settings, ...patch } });
  const setAgent = (id: string, patch: Partial<AgentProfile>) => set({ agents: settings.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const setRepo = (id: string, patch: Partial<NonNullable<RepoConfig["agent"]>>) => update({ repos: draft.repos.map((r) => (r.id === id ? { ...r, agent: { enabled: true, ...r.agent, ...patch } } : r)) });
  const addAgent = () => {
    const id = slugId("agent", settings.agents.map((a) => a.id));
    set({ agents: [...settings.agents, { id, name: "New agent", command: ["my-agent-cli", "{prompt}"], prompts: { implement: "Implement the OpenSpec change {change}: run `openspec instructions apply --change {change}` and follow it." } }] });
  };
  const removeAgent = (id: string) => {
    const agents = settings.agents.filter((a) => a.id !== id);
    update({
      agentSessions: { ...settings, agents, defaultAgent: settings.defaultAgent === id ? agents[0].id : settings.defaultAgent },
      repos: draft.repos.map((r) => (r.agent?.agentId === id ? { ...r, agent: { ...r.agent, agentId: undefined } } : r)),
    });
  };
  const tracked = draft.repos.filter((r) => r.enabled);
  const worktrees = sessions.filter((s) => s.worktreePath);

  return (
    <section class="panel">
      <h2>Agent sessions</h2>
      <p class="hint">
        Start an agent CLI for a change straight from its card; it opens in a terminal here in the dashboard — the same program you would run in your own terminal, with its own
        login, settings and permission prompts. <strong>Turning this on lets the dashboard start that program on this machine, and the agent can change files and run commands as
        you allow it to.</strong> Each session works in its own git worktree under <code>~/.openspec-dashboard/worktrees/</code>, never in a repository's main checkout. It
        applies to <strong>every tracked repository</strong>; switch individual ones off below.
      </p>
      <div class="row">
        <label class="check">
          <input type="checkbox" checked={settings.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
          Enable agent sessions
        </label>
      </div>

      <fieldset class="agent-fields" disabled={!settings.enabled}>
        <h2>Agents</h2>
        <p class="hint">Any CLI that runs interactively in a terminal works. Claude Code is preconfigured; add others with their own command and prompts.</p>
        {settings.agents.map((agent) => (
          <AgentEditor
            key={agent.id}
            agent={agent}
            found={found.find((f) => f.id === agent.id)}
            isDefault={agent.id === settings.defaultAgent}
            canRemove={settings.agents.length > 1}
            onChange={(patch) => setAgent(agent.id, patch)}
            onRemove={() => removeAgent(agent.id)}
            onDefault={() => set({ defaultAgent: agent.id })}
          />
        ))}
        <div class="row">
          <button type="button" class="btn sm" onClick={addAgent}>
            + Add agent
          </button>
          {!settings.agents.some((a) => a.id === CLAUDE_PROFILE.id) && (
            <button type="button" class="btn sm ghost" onClick={() => set({ agents: [...settings.agents, structuredClone(CLAUDE_PROFILE)] })}>
              + Claude Code preset
            </button>
          )}
        </div>

        <h2>Repositories</h2>
        <div class="list">
          {tracked.map((repo) => (
            <div class="agent-repo" key={repo.id}>
              <label class="check">
                <input type="checkbox" checked={repoAgentEnabled(repo)} onChange={(e) => setRepo(repo.id, { enabled: e.currentTarget.checked })} />
                <strong>{repo.name}</strong>
              </label>
              <span class="row">
                <span class="path hint" title={repo.path}>
                  {repo.path}
                </span>
                {settings.agents.length > 1 && repoAgentEnabled(repo) && (
                  <select class="input" value={repo.agent?.agentId ?? ""} onChange={(e) => setRepo(repo.id, { agentId: e.currentTarget.value || undefined })}>
                    <option value="">default agent</option>
                    {settings.agents.map((a) => (
                      <option value={a.id} key={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                )}
              </span>
            </div>
          ))}
          {tracked.length === 0 && <span class="hint">No tracked repositories yet.</span>}
        </div>
      </fieldset>

      {worktrees.length > 0 && (
        <>
          <h2>Session worktrees</h2>
          <div class="list">
            {worktrees.map((s) => (
              <div class="row" key={s.id}>
                <span class="badge">{s.state}</span>
                <code class="grow">{s.worktreePath}</code>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
