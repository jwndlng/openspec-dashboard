// Settings section for agent sessions. Off by default; turning it on lets an agent started from the dashboard change
// files in the opted-in repositories, so the section says so plainly.
import { useEffect, useState } from "preact/hooks";
import { DEFAULT_ALLOWED_TOOLS } from "../shared/agentDefaults.ts";
import { repoAgentEnabled, type AgentAvailability, type AgentSessionsConfig, type Config, type RepoConfig, type Session } from "../shared/types.ts";
import { api } from "./api.ts";
import { parseToolList } from "./sessionState.ts";

interface Props {
  draft: Config;
  update: (patch: Partial<Config>) => void;
}

export function AgentSettings({ draft, update }: Props) {
  const [agent, setAgent] = useState<AgentAvailability>();
  const [sessions, setSessions] = useState<Session[]>([]);
  useEffect(() => {
    api
      .sessions()
      .then((r) => {
        setAgent(r.agent);
        setSessions(r.sessions);
      })
      .catch(() => setAgent({ available: false, reason: "could not ask the dashboard server" }));
  }, []);

  const settings = draft.agentSessions;
  const set = (patch: Partial<AgentSessionsConfig>) => update({ agentSessions: { ...settings, ...patch } });
  const setRepo = (id: string, patch: Partial<NonNullable<RepoConfig["agent"]>>) =>
    update({ repos: draft.repos.map((r) => (r.id === id ? { ...r, agent: { enabled: true, allowedTools: [], ...r.agent, ...patch } } : r)) });
  const cliMissing = agent !== undefined && !agent.available;
  const worktrees = sessions.filter((s) => s.worktreePath);

  return (
    <section class="panel">
      <h2>Agent sessions</h2>
      <p class="hint">
        Lets you open an interactive agent session for a change from its card. <strong>Turning this on allows an agent started from the dashboard to edit files and run the
        allowed commands</strong> in a dedicated git worktree of <strong>every tracked repository</strong> — never in the main checkout. Switch individual repositories off below. It runs your own <code>claude</code> CLI on its
        existing login; the dashboard does not handle credentials, and removes API-key variables from the agent's environment so your subscription is used.
      </p>
      <div class="row">
        <label class="check" title={cliMissing ? agent?.reason : undefined}>
          <input type="checkbox" checked={settings.enabled} disabled={cliMissing && !settings.enabled} onChange={(e) => set({ enabled: e.currentTarget.checked })} />
          Enable agent sessions
        </label>
        {agent === undefined ? (
          <span class="hint">checking for the agent CLI…</span>
        ) : agent.available ? (
          <span class="badge ok">✓ agent CLI found · {agent.version}</span>
        ) : (
          <span class="badge danger">⚠ {agent.reason}</span>
        )}
      </div>

      <fieldset class="agent-fields" disabled={!settings.enabled}>
        <div class="row">
          <label class="check">
            Agents working at once
            <input class="input num" type="number" min={1} value={settings.maxRunning} onInput={(e) => set({ maxRunning: Number(e.currentTarget.value) })} />
          </label>
          <label class="check">
            Stop an idle agent process after
            <input class="input num" type="number" min={1} value={settings.idleMinutes} onInput={(e) => set({ idleMinutes: Number(e.currentTarget.value) })} />
            minutes (the conversation resumes on your next message)
          </label>
        </div>
        <div class="row">
          <label class="check grow">
            Draft artifacts
            <input class="input mono grow" value={settings.commands.draft} onInput={(e) => set({ commands: { ...settings.commands, draft: e.currentTarget.value } })} />
          </label>
          <label class="check grow">
            Archive
            <input class="input mono grow" value={settings.commands.archive} onInput={(e) => set({ commands: { ...settings.commands, archive: e.currentTarget.value } })} />
          </label>
          <label class="check grow">
            Implement
            <input class="input mono grow" value={settings.commands.implement} onInput={(e) => set({ commands: { ...settings.commands, implement: e.currentTarget.value } })} />
          </label>
        </div>
        <p class="hint">
          Opening instructions; <code>{"{change}"}</code> is the only placeholder. Always allowed: <code>{DEFAULT_ALLOWED_TOOLS.join(", ")}</code>. Anything else is denied without a
          prompt and shown in the transcript. Your personal Claude settings and their allow rules are not inherited; a repository's own <code>.claude/settings.json</code> is. The
          CLI may still run its small built-in set of read-only commands.
        </p>

        <div class="list">
          {draft.repos
            .filter((r) => r.enabled)
            .map((repo) => (
              <div class="agent-repo" key={repo.id}>
                <label class="check">
                  <input type="checkbox" checked={repoAgentEnabled(repo)} onChange={(e) => setRepo(repo.id, { enabled: e.currentTarget.checked })} />
                  <strong>{repo.name}</strong>
                </label>
                <span class="path hint" title={repo.path}>
                  {repo.path}
                </span>
                {repoAgentEnabled(repo) && (
                  <details class="agent-tools">
                    <summary class="hint">
                      additional allowed tools{(repo.agent?.allowedTools.length ?? 0) > 0 ? ` (${repo.agent?.allowedTools.length})` : ""}
                    </summary>
                  <label class="agent-tools">
                    <span class="hint">Additional allowed tools, one per line — e.g. <code>Bash(bun run check*)</code></span>
                    <textarea
                      class="input mono"
                      rows={2}
                      value={(repo.agent?.allowedTools ?? []).join("\n")}
                      onInput={(e) => setRepo(repo.id, { allowedTools: parseToolList(e.currentTarget.value) })}
                    />
                  </label>
                  </details>
                )}
              </div>
            ))}
          {draft.repos.filter((r) => r.enabled).length === 0 && <span class="hint">No tracked repositories yet.</span>}
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
