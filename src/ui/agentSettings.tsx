// Settings section for agent sessions. Off by default; turning it on lets you start an agent CLI in a terminal for a
// change, so the section says plainly what that means. An agent is just a command line and its opening prompts.
import { Fragment } from "preact";
import { useEffect, useState } from "preact/hooks";
import { CLAUDE_PROFILE } from "../shared/agentDefaults.ts";
import { DEFAULT_INTEGRATE_PROMPT, DEFAULT_RESOLVE_CONFLICTS_PROMPT, DEFAULT_SHIP_PROMPT, SESSION_ACTIONS, type AgentAvailability, type AgentProfile, type AgentSessionsConfig, type Config, type PromptKey, type Session, type SessionAction, type Shortcut } from "../shared/types.ts";
import { api } from "./api.ts";
import { addShortcut, moveShortcut, removeShortcut, restoredShortcuts } from "./quickReplies.ts";
import { parseArgLines, slugId } from "./sessionState.ts";
import { followInApp, href } from "./url.ts";

interface Props {
  draft: Config;
  update: (patch: Partial<Config>) => void;
}

const ACTION_LABEL: Record<SessionAction, string> = { draft: "Draft artifacts", implement: "Implement", validate: "Validate", archive: "Archive" };

/** Exported for the tests: one profile's fields, hook-free so they can be rendered without a DOM. */
export function AgentEditor({ agent, found, isDefault, canRemove, onChange, onRemove, onDefault }: { agent: AgentProfile; found?: AgentAvailability; isDefault: boolean; canRemove: boolean; onChange: (patch: Partial<AgentProfile>) => void; onRemove: () => void; onDefault: () => void }) {
  /** Additional instructions for one prompt; an empty field is stored as absent, as a removed prompt is. */
  const setSuffix = (key: PromptKey, value: string) => {
    const promptSuffixes = { ...agent.promptSuffixes };
    if (value.trim()) promptSuffixes[key] = value;
    else delete promptSuffixes[key];
    onChange({ promptSuffixes: Object.keys(promptSuffixes).length ? promptSuffixes : undefined });
  };
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
          <Fragment key={action}>
            <label class="check grow">
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
            <label class="agent-tools">
              <span class="hint">
                Additional {ACTION_LABEL[action]} instructions (optional): appended to that prompt as one line, and only when it is set — this text alone does not offer the
                starter. <code>{"{change}"}</code> may be used.
              </span>
              <input class="input mono" placeholder="nothing is appended" value={agent.promptSuffixes?.[action] ?? ""} onInput={(e) => setSuffix(action, e.currentTarget.value)} />
            </label>
          </Fragment>
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
          <span class="hint">
            Additional <strong>Ship</strong> instructions (optional): appended as one line to the Ship prompt above — or to the default shown there, so a standing instruction
            about pull requests needs no prompt of its own. <code>{"{change}"}</code> may be used.
          </span>
          <textarea class="input mono" rows={2} placeholder="nothing is appended" value={agent.promptSuffixes?.ship ?? ""} onInput={(e) => setSuffix("ship", e.currentTarget.value)} />
        </label>
        <label class="agent-tools">
          <span class="hint">
            Resolve conflicts prompt (optional): what <strong>Resolve conflicts</strong> asks this agent when a session's branch no longer merges into the default branch. Empty
            uses the default shown; <code>{"{change}"}</code> may be used. The dashboard merges nothing itself — it only asks.
          </span>
          <textarea
            class="input mono"
            rows={3}
            placeholder={DEFAULT_RESOLVE_CONFLICTS_PROMPT}
            value={agent.prompts.resolveConflicts ?? ""}
            onInput={(e) => {
              const prompts = { ...agent.prompts };
              const value = e.currentTarget.value;
              if (value.trim()) prompts.resolveConflicts = value;
              else delete prompts.resolveConflicts;
              onChange({ prompts });
            }}
          />
        </label>
        <label class="agent-tools">
          <span class="hint">
            Additional <strong>Resolve conflicts</strong> instructions (optional): appended as one line to the prompt above — or to the default shown there, so a standing
            instruction about how this project reconciles a branch needs no prompt of its own. <code>{"{change}"}</code> may be used.
          </span>
          <textarea
            class="input mono"
            rows={2}
            placeholder="nothing is appended"
            value={agent.promptSuffixes?.resolveConflicts ?? ""}
            onInput={(e) => setSuffix("resolveConflicts", e.currentTarget.value)}
          />
        </label>
        <label class="agent-tools">
          <span class="hint">
            Integrate prompt (optional): what <strong>Integrate</strong> asks this agent in a repository that does not use OpenSpec yet. It runs in that repository's folder, so
            it takes <strong>no placeholder at all</strong> — nothing from this page becomes part of the command line. Empty uses the default shown.
          </span>
          <textarea
            class="input mono"
            rows={3}
            placeholder={DEFAULT_INTEGRATE_PROMPT}
            value={agent.prompts.integrate ?? ""}
            onInput={(e) => {
              const prompts = { ...agent.prompts };
              const value = e.currentTarget.value;
              if (value.trim()) prompts.integrate = value;
              else delete prompts.integrate;
              onChange({ prompts });
            }}
          />
        </label>
        <label class="agent-tools">
          <span class="hint">
            Additional <strong>Integrate</strong> instructions (optional): appended as one line to the Integrate prompt above — or to the default shown there. Like that prompt they take{" "}
            <strong>no placeholder at all</strong>.
          </span>
          <textarea
            class="input mono"
            rows={2}
            placeholder="nothing is appended"
            value={agent.promptSuffixes?.integrate ?? ""}
            onInput={(e) => setSuffix("integrate", e.currentTarget.value)}
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

/**
 * The shortcuts of the agent console: what its controls read and what each one types into the running agent. The two are
 * independent, so a one-word control can carry several sentences; the prompt is sent exactly as written, which is why it
 * is one line and takes no placeholder.
 */
function ShortcutEditor({ shortcuts, onChange }: { shortcuts: Shortcut[]; onChange: (shortcuts: Shortcut[]) => void }) {
  const patch = (id: string, fields: Partial<Shortcut>) => onChange(shortcuts.map((s) => (s.id === id ? { ...s, ...fields } : s)));
  const add = () => onChange(addShortcut(shortcuts));
  return (
    <>
      <h2>Shortcuts</h2>
      <p class="hint">
        The controls beside a session's terminal. The <strong>title</strong> is what the control reads; the{" "}
        <strong>prompt</strong> is what the agent receives, typed exactly as written — <strong>one line, no placeholder</strong>, because a shortcut is offered in every session,
        including those that belong to no change. A shortcut is only ever typed and confirmed the way any text sent for you is: at a selection menu nothing is confirmed. Remove
        them all and the row disappears.
      </p>
      <div class="list">
        {shortcuts.map((shortcut, i) => (
          <div class="agent-shortcut" key={shortcut.id}>
            <input class="input" aria-label={`Title of shortcut ${i + 1}`} placeholder="Title" value={shortcut.title} onInput={(e) => patch(shortcut.id, { title: e.currentTarget.value })} />
            <input
              class="input mono"
              aria-label={`Prompt of shortcut ${i + 1}`}
              placeholder="what the agent receives"
              value={shortcut.prompt}
              onInput={(e) => patch(shortcut.id, { prompt: e.currentTarget.value })}
            />
            <span class="row">
              <button type="button" class="btn sm ghost" aria-label={`Move ${shortcut.title} earlier`} disabled={i === 0} onClick={() => onChange(moveShortcut(shortcuts, i, -1))}>
                ↑
              </button>
              <button
                type="button"
                class="btn sm ghost"
                aria-label={`Move ${shortcut.title} later`}
                disabled={i === shortcuts.length - 1}
                onClick={() => onChange(moveShortcut(shortcuts, i, 1))}
              >
                ↓
              </button>
              <button type="button" class="btn sm ghost" aria-label={`Remove ${shortcut.title}`} onClick={() => onChange(removeShortcut(shortcuts, shortcut.id))}>
                Remove
              </button>
            </span>
          </div>
        ))}
        {shortcuts.length === 0 && <span class="hint">No shortcuts — a session's terminal shows no shortcut row.</span>}
      </div>
      <div class="row">
        <button type="button" class="btn sm" onClick={add}>
          + Add shortcut
        </button>
        <button type="button" class="btn sm ghost" onClick={() => onChange(restoredShortcuts())}>
          Restore defaults
        </button>
      </div>
    </>
  );
}

/** Where the per-project switch and agent went: each project's row or tile on Projects (agent-sessions). */
export function PerProjectNote() {
  return (
    <>
      <h2>Projects</h2>
      <p class="hint per-project">
        Each project has its own <strong>Agent sessions</strong> switch, Enabled unless you turn it off, and — with more than one agent here — its own agent:{" "}
        <a href={href("/")} onClick={(e) => followInApp(e, "/")}>
          set them on Projects
        </a>
        , saved at once.
      </p>
    </>
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
  const addAgent = () => {
    const id = slugId("agent", settings.agents.map((a) => a.id));
    set({ agents: [...settings.agents, { id, name: "New agent", command: ["my-agent-cli", "{prompt}"], prompts: { implement: "Implement the OpenSpec change {change}: run `openspec instructions apply --change {change}` and follow it." } }] });
  };
  const removeAgent = (id: string) => {
    const agents = settings.agents.filter((a) => a.id !== id);
    // Repositories that chose it go back to the default agent when Settings saves (`withLatestRepos`).
    set({ agents, defaultAgent: settings.defaultAgent === id ? agents[0].id : settings.defaultAgent });
  };
  // The main console runs in its folder, not in a worktree.
  const worktrees = sessions.filter((s) => !s.console && s.worktreePath);

  return (
    <section class="panel">
      <h2>Agent sessions</h2>
      <p class="hint">
        Start an agent CLI for a change straight from its card; it opens in a terminal here in the dashboard — the same program you would run in your own terminal, with its own
        login, settings and permission prompts. <strong>Turning this on lets the dashboard start that program on this machine, and the agent can change files and run commands as
        you allow it to.</strong> Each session works in its own git worktree under <code>~/.openspec-dashboard/worktrees/</code>, never in a repository's main checkout — except an{" "}
        <strong>Integrate</strong> session, which runs in the repository folder itself to set it up for OpenSpec. It applies to <strong>every tracked repository</strong>; switch
        individual ones off on Projects.
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

        <ShortcutEditor shortcuts={settings.shortcuts} onChange={(shortcuts) => set({ shortcuts })} />

        <h2>Console</h2>
        <label class="agent-tools">
          <span class="hint">
            Console folder (optional): the console button in the top bar opens your default agent here, outside every change and without a prompt. Empty uses{" "}
            <code>~/.openspec-dashboard/console/</code>. A folder above your repositories lets it reach them; a folder inside a tracked repository is refused, so it never runs
            in a main checkout. What the agent does there is up to its own permission prompts.
          </span>
          <input
            class="input mono"
            placeholder="~/.openspec-dashboard/console"
            value={settings.consoleDir ?? ""}
            onInput={(e) => set({ consoleDir: e.currentTarget.value.trim() || undefined })}
          />
        </label>

        <PerProjectNote />
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
