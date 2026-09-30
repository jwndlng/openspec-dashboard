import { useEffect, useRef, useState } from "preact/hooks";
import { availableName, nameHints } from "../shared/nameHints.ts";
import { integrateUnavailable, type Config, type DiscoveredRepo, type DiscoverResult, type IntegratableRepo, type RepoConfig, type Snapshot } from "../shared/types.ts";
import { AgentSettings } from "./agentSettings.tsx";
import { api, ApiError } from "./api.ts";
import { EnvironmentPanel } from "./environment.tsx";
import { environmentAttention, environmentCount, type EnvironmentState } from "./environmentState.ts";
import { useSessionUi } from "./sessions.tsx";
import { SettingsNav, type SettingsSection, SettingsSections, useSectionNav } from "./settingsNav.tsx";
import { SharedConfigPanel } from "./sharedConfig.tsx";

interface Props {
  config: Config | null;
  snapshot: Snapshot | null;
  onSaved: (config: Config) => void;
  /** Something changed that the next scan will pick up (shared config saved or applied). */
  onRescan: () => void;
  /** The latest environment report, owned by the app shell: the hero reads the same one. */
  environment: EnvironmentState;
  /** **Re-check**: asks for a fresh report. Nothing about it belongs to the page's draft. */
  onRecheckEnvironment: () => void;
}

export function Settings({ config, snapshot, onSaved, onRescan, environment, onRecheckEnvironment }: Props) {
  const [draft, setDraft] = useState<Config | null>(config);
  const [dirty, setDirty] = useState(false);
  const [newRoot, setNewRoot] = useState("");
  const [newIgnore, setNewIgnore] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<DiscoveredRepo[]>([]);
  const [integratable, setIntegratable] = useState<IntegratableRepo[]>([]);
  const [integrating, setIntegrating] = useState<string>();
  const [integrateError, setIntegrateError] = useState<{ path: string; reason: string }>();
  const [discovered, setDiscovered] = useState(false);
  const discoverSeq = useRef(0);
  const [discoverErrors, setDiscoverErrors] = useState<DiscoverResult["errors"]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "danger"; text: string; issues?: string[] } | null>(null);

  useEffect(() => {
    if (config && !dirty) setDraft(config);
  }, [config, dirty]);

  // Defined before the early return below: the effect that calls it also runs for a render that returned early
  // (Settings opened directly, config still loading), where a later `const` would not be initialised yet.
  /**
   * Read-only preview of what is under `roots` and outside `ignorePaths` (usually the unsaved draft values).
   * Runs overlap when they are edited quickly; only the latest response is applied.
   */
  const runDiscovery = async (roots: string[], ignorePaths: string[]) => {
    const seq = ++discoverSeq.current;
    if (roots.length === 0) {
      setCandidates([]);
      setIntegratable([]);
      setDiscoverErrors([]);
      setDiscovered(false);
      setDiscovering(false);
      return;
    }
    setDiscovering(true);
    try {
      const result = await api.discover(roots, ignorePaths);
      if (seq !== discoverSeq.current) return;
      setCandidates(result.candidates);
      setIntegratable(result.integratable);
      setDiscoverErrors(result.errors);
      setDiscovered(true);
    } catch (err) {
      if (seq !== discoverSeq.current) return;
      setMessage({ kind: "danger", text: err instanceof Error ? err.message : String(err), issues: err instanceof ApiError ? err.issues : [] });
    } finally {
      if (seq === discoverSeq.current) setDiscovering(false);
    }
  };

  const ui = useSessionUi();
  const loaded = config !== null;
  useEffect(() => {
    if (config && config.scanRoots.length > 0) void runDiscovery(config.scanRoots, config.ignorePaths);
  }, [loaded]);

  // Hooks first: the ids are all the hook needs, and they are known before the draft is.
  const scroller = useRef<HTMLDivElement>(null);
  const sectionIds = draft ? ["roots", "tracked", "discovered", "integratable", "scanning", "agents", ...(config ? ["shared-config"] : []), "environment"] : [];
  const nav = useSectionNav(scroller, sectionIds);

  if (!draft) return <div class="settings">Loading…</div>;

  const update = (patch: Partial<Config>) => {
    setDraft({ ...draft, ...patch });
    setDirty(true);
    setMessage(null);
  };
  const updateRepo = (id: string, patch: Partial<RepoConfig>) =>
    update({ repos: draft.repos.map((r) => (r.id === id ? { ...r, ...patch } : r)) });

  const addRoot = () => {
    const root = newRoot.trim();
    if (!root || draft.scanRoots.includes(root)) return;
    setRoots([...draft.scanRoots, root]);
    setNewRoot("");
  };

  const setRoots = (scanRoots: string[]) => {
    update({ scanRoots });
    void runDiscovery(scanRoots, draft.ignorePaths);
  };

  const setIgnorePaths = (ignorePaths: string[]) => {
    update({ ignorePaths });
    void runDiscovery(draft.scanRoots, ignorePaths);
  };
  const ignore = (path: string) => {
    if (!draft.ignorePaths.includes(path)) setIgnorePaths([...draft.ignorePaths, path]);
  };
  const addIgnore = () => {
    const path = newIgnore.trim();
    if (!path) return;
    ignore(path);
    setNewIgnore("");
  };

  // `sameRemoteAs` describes one discovery run; it is not part of the config.
  const enableCandidate = ({ sameRemoteAs: _info, ...candidate }: DiscoveredRepo) => {
    const name = availableName(candidate, draft.repos.map((r) => r.name));
    update({ repos: [...draft.repos, { ...candidate, name, enabled: true }].sort((x, y) => x.path.localeCompare(y.path)) });
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveConfig(draft);
      setDraft(saved);
      setDirty(false);
      setMessage({ kind: "ok", text: "Saved." });
      onSaved(saved);
      void runDiscovery(saved.scanRoots, saved.ignorePaths); // forgotten repos become candidates again
    } catch (err) {
      setMessage({ kind: "danger", text: err instanceof Error ? err.message : String(err), issues: err instanceof ApiError ? err.issues : [] });
    } finally {
      setSaving(false);
    }
  };

  // Candidates come from the saved config's point of view; hide the ones already enabled in the draft.
  const draftIds = new Set(draft.repos.map((r) => r.id));
  const newCandidates = candidates.filter((c) => !draftIds.has(c.id));
  const enabledCount = draft.repos.filter((r) => r.enabled).length;
  // Already tracked in the draft, or already being set up: neither is still waiting for OpenSpec.
  const newIntegratable = integratable.filter((r) => !draftIds.has(r.id));
  const hints = nameHints([...draft.repos, ...newCandidates, ...newIntegratable]);
  // Why Integrate cannot be offered at all. The rows are listed either way: knowing the repository is there is useful
  // before deciding to turn agent sessions on.
  const integrateOff = integrateUnavailable(draft, ui.agents);
  const runningFor = (path: string) => ui.integrations.find((s) => s.folder === path && s.state === "running");
  const integrate = async (repo: IntegratableRepo) => {
    setIntegrating(repo.path);
    setIntegrateError(undefined);
    try {
      const session = await api.startIntegration(repo.path);
      await ui.refresh();
      ui.showIntegration(session.id);
    } catch (err) {
      // A session that was never created has no panel to report itself in, so the row says why.
      setIntegrateError({ path: repo.path, reason: err instanceof Error ? err.message : String(err) });
    } finally {
      setIntegrating(undefined);
    }
  };
  const hintBadge = (id: string) => {
    const hint = hints.get(id);
    return hint ? <span class="badge mono" title="another listed repository has the same name">{hint}</span> : null;
  };

  // One list drives both the navigation and the page, so a panel cannot exist without its navigation entry.
  const sections: SettingsSection[] = [
    {
      id: "roots",
      label: "Workspace roots",
      content: (
        <section class="panel">
          <h2>Workspace roots</h2>
          <p class="hint">Directories to search (4 levels deep) for repositories containing <code>openspec/config.yaml</code>. Discovery runs whenever the roots change and only previews what it finds — nothing is tracked until you enable it.</p>
          <div class="list">
            {draft.scanRoots.map((root) => (
              <div class="row">
                <code class="grow">{root}</code>
                <button type="button" class="btn sm ghost" onClick={() => setRoots(draft.scanRoots.filter((r) => r !== root))}>
                  remove
                </button>
              </div>
            ))}
            {draft.scanRoots.length === 0 && <span class="hint">No roots yet — try <code>~/Workspace</code>.</span>}
          </div>
          <div class="row">
            <input class="input mono grow" placeholder="/absolute/path or ~/Workspace" value={newRoot} onInput={(e) => setNewRoot(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && addRoot()} />
            <button type="button" class="btn" onClick={addRoot} disabled={!newRoot.trim()}>
              Add root
            </button>
            <button type="button" class="btn" onClick={() => runDiscovery(draft.scanRoots, draft.ignorePaths)} disabled={discovering || draft.scanRoots.length === 0}>
              {discovering ? "Discovering…" : "Rediscover"}
            </button>
          </div>
          {discoverErrors.map((e) => (
            <div class="notice warn">
              {e.root}: {e.message}
            </div>
          ))}
          <h2>Ignored paths</h2>
          <p class="hint">Discovery skips these directories and everything below them. Ignored paths only affect discovery: a repository that is already tracked stays tracked until you forget it.</p>
          <div class="list">
            {draft.ignorePaths.map((path) => (
              <div class="row">
                <code class="grow">{path}</code>
                <button type="button" class="btn sm ghost" onClick={() => setIgnorePaths(draft.ignorePaths.filter((p) => p !== path))}>
                  remove
                </button>
              </div>
            ))}
            {draft.ignorePaths.length === 0 && <span class="hint">Nothing ignored.</span>}
          </div>
          <div class="row">
            <input class="input mono grow" placeholder="/absolute/path or ~/Workspace/mirror" value={newIgnore} onInput={(e) => setNewIgnore(e.currentTarget.value)} onKeyDown={(e) => e.key === "Enter" && addIgnore()} />
            <button type="button" class="btn" onClick={addIgnore} disabled={!newIgnore.trim()}>
              Ignore path
            </button>
          </div>
        </section>
      ),
    },
    {
      id: "tracked",
      label: "Tracked repositories",
      count: `${enabledCount}/${draft.repos.length}`,
      content: (
        <section class="panel">
          <h2>Tracked repositories · {enabledCount} of {draft.repos.length} enabled</h2>
          <p class="hint">Only enabled repositories are scanned and shown on the board. Names are display-only. Forgetting (×) a repository returns it to the discovered list.</p>
          <div class="list">
            {draft.repos.map((repo) => (
              <div class={`item ${repo.enabled ? "" : "off"}`} key={repo.id}>
                <label class="check" title="track this repository">
                  <input type="checkbox" checked={repo.enabled} onChange={(e) => updateRepo(repo.id, { enabled: e.currentTarget.checked })} />
                </label>
                <input class="input name" value={repo.name} onInput={(e) => updateRepo(repo.id, { name: e.currentTarget.value })} />
                <span class="path" title={repo.path}>
                  {hintBadge(repo.id)} {repo.path}
                </span>
                <button type="button" class="btn sm ghost" title="forget this repository" onClick={() => update({ repos: draft.repos.filter((r) => r.id !== repo.id) })}>
                  ×
                </button>
              </div>
            ))}
            {draft.repos.length === 0 && <span class="hint">Nothing tracked yet — enable a discovered repository below.</span>}
          </div>
        </section>
      ),
    },
    {
      id: "discovered",
      label: "Discovered",
      count: discovering ? "…" : String(newCandidates.length),
      attention: !discovering && newCandidates.length > 0,
      countNote: "new",
      countTitle: "waiting to be enabled",
      content: (
        <section class="panel">
          <h2>Discovered · {newCandidates.length} not tracked{discovering ? " · discovering…" : ""}</h2>
          <p class="hint">Repositories found under the workspace roots. Enable the ones to track, then save. "Same remote" marks a probable second clone; it is information only.</p>
          <div class="list">
            {newCandidates.map((repo) => (
              <div class="item candidate" key={repo.id}>
                <span class="name">{repo.name}</span>
                <span class="path" title={repo.path}>
                  {hintBadge(repo.id)}{" "}
                  {repo.sameRemoteAs && (
                    <span class="badge" title={`same origin remote as:\n${repo.sameRemoteAs.map((r) => `${r.path}${r.tracked ? " (tracked)" : ""}`).join("\n")}`}>
                      same remote as {[...new Set(repo.sameRemoteAs.map((r) => r.name))].join(", ")}
                    </span>
                  )}{" "}
                  {repo.path}
                </span>
                <span class="row">
                  <button type="button" class="btn sm" onClick={() => enableCandidate(repo)}>
                    Enable
                  </button>
                  <button type="button" class="btn sm ghost" title="add this path to the ignored paths" onClick={() => ignore(repo.path)}>
                    Ignore
                  </button>
                </span>
              </div>
            ))}
            {newCandidates.length === 0 && (
              <span class="hint">
                {draft.scanRoots.length === 0 ? "Add a workspace root to discover repositories." : discovering ? "Discovering…" : discovered ? "No untracked repositories found." : ""}
              </span>
            )}
          </div>
        </section>
      ),
    },
    {
      id: "integratable",
      label: "Without OpenSpec",
      count: discovering ? "…" : String(newIntegratable.length),
      content: (
        <section class="panel">
          <h2>Without OpenSpec · {newIntegratable.length} repositories{discovering ? " · discovering…" : ""}</h2>
          <p class="hint">
            Git repositories under the workspace roots that do not use OpenSpec yet — the list above is for repositories that already do. <strong>Integrate</strong> starts your
            agent in the repository to run <code>openspec init</code> there; the dashboard tracks it once{" "}
            <code>openspec/config.yaml</code> exists. The agent works <strong>in the checkout itself</strong>, with no branch and no undo.
          </p>
          {integrateOff && <div class="notice">Integrate is unavailable: {integrateOff}.</div>}
          <div class="list">
            {newIntegratable.map((repo) => {
              const running = runningFor(repo.path);
              return (
                <div class="item candidate integratable" key={repo.id}>
                  <span class="name">{repo.name}</span>
                  <span class="path" title={repo.path}>
                    {hintBadge(repo.id)} {repo.path}
                  </span>
                  <span class="row">
                    {running ? (
                      <button type="button" class="btn sm" onClick={() => ui.showIntegration(running.id)}>
                        Setting up…
                      </button>
                    ) : (
                      <button type="button" class="btn sm" disabled={integrateOff !== undefined || integrating === repo.path} title={integrateOff ?? `Run openspec init in ${repo.path}`} onClick={() => void integrate(repo)}>
                        {integrating === repo.path ? "Starting…" : "Integrate"}
                      </button>
                    )}
                    <button type="button" class="btn sm ghost" title="add this path to the ignored paths" onClick={() => ignore(repo.path)}>
                      Ignore
                    </button>
                  </span>
                  {integrateError?.path === repo.path && <span class="hint danger">{integrateError.reason}</span>}
                </div>
              );
            })}
            {newIntegratable.length === 0 && (
              <span class="hint">
                {draft.scanRoots.length === 0 ? "Add a workspace root to discover repositories." : discovering ? "Discovering…" : discovered ? "Every repository under the roots already uses OpenSpec." : ""}
              </span>
            )}
          </div>
        </section>
      ),
    },
    {
      id: "scanning",
      label: "Scanning",
      content: (
        <section class="panel">
          <h2>Scanning</h2>
          <div class="row">
            <label class="check">
              Poll every
              <input class="input num" type="number" min={10} value={draft.pollIntervalSeconds} onInput={(e) => update({ pollIntervalSeconds: Number(e.currentTarget.value) })} />
              seconds
            </label>
            <span class="hint">· port {draft.port} (change in <code>~/.openspec-dashboard/config.json</code>, restart to apply)</span>
          </div>
        </section>
      ),
    },
    { id: "agents", label: "Agent sessions", content: <AgentSettings draft={draft} update={update} /> },
    // Works on the saved config, not the draft above: it has its own save and only ever targets tracked repositories.
    ...(config ? [{ id: "shared-config", label: "Shared OpenSpec config", content: <SharedConfigPanel config={config} snapshot={snapshot} onApplied={onRescan} /> }] : []),
    // Last: it configures nothing, and it is where the hero's environment indicator links to. Outside the draft, so
    // re-checking never marks the page as having unsaved changes.
    {
      id: "environment",
      label: "Environment",
      count: environmentCount(environment),
      attention: environmentAttention(environment),
      countTitle: "checks that need attention",
      content: <EnvironmentPanel state={environment} onRecheck={onRecheckEnvironment} />,
    },
  ];

  return (
    <>
      {/* One scroll area for the whole page: the navigation moves with the sections, and the wheel works anywhere. */}
      <div class="settings-scroll" ref={scroller}>
        <div class="settings-layout">
          <SettingsNav sections={sections} current={nav.current} onJump={nav.jump} />
          <div class="settings">
            <SettingsSections sections={sections} />
          </div>
        </div>
      </div>
      <div class="savebar">
        <button type="button" class="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {dirty && <span class="badge warning">unsaved changes</span>}
        {message && (
          <span class={`notice ${message.kind}`}>
            {message.text}
            {message.issues?.length ? ` — ${message.issues.join("; ")}` : ""}
          </span>
        )}
      </div>
    </>
  );
}
