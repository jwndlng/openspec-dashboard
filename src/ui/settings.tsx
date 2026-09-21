import { useEffect, useRef, useState } from "preact/hooks";
import type { Config, DiscoverResult, RepoConfig, Snapshot } from "../shared/types.ts";
import { AgentSettings } from "./agentSettings.tsx";
import { api, ApiError } from "./api.ts";
import { SettingsNav, type SettingsSection, SettingsSections, useSectionNav } from "./settingsNav.tsx";
import { SharedConfigPanel } from "./sharedConfig.tsx";

interface Props {
  config: Config | null;
  snapshot: Snapshot | null;
  onSaved: (config: Config) => void;
  /** Something changed that the next scan will pick up (shared config saved or applied). */
  onRescan: () => void;
}

export function Settings({ config, snapshot, onSaved, onRescan }: Props) {
  const [draft, setDraft] = useState<Config | null>(config);
  const [dirty, setDirty] = useState(false);
  const [newRoot, setNewRoot] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<RepoConfig[]>([]);
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
   * Read-only preview of what is under `roots` (usually the unsaved draft roots).
   * Runs overlap when roots are edited quickly; only the latest response is applied.
   */
  const runDiscovery = async (roots: string[]) => {
    const seq = ++discoverSeq.current;
    if (roots.length === 0) {
      setCandidates([]);
      setDiscoverErrors([]);
      setDiscovered(false);
      setDiscovering(false);
      return;
    }
    setDiscovering(true);
    try {
      const result = await api.discover(roots);
      if (seq !== discoverSeq.current) return;
      setCandidates(result.candidates);
      setDiscoverErrors(result.errors);
      setDiscovered(true);
    } catch (err) {
      if (seq !== discoverSeq.current) return;
      setMessage({ kind: "danger", text: err instanceof Error ? err.message : String(err), issues: err instanceof ApiError ? err.issues : [] });
    } finally {
      if (seq === discoverSeq.current) setDiscovering(false);
    }
  };

  const loaded = config !== null;
  useEffect(() => {
    if (config && config.scanRoots.length > 0) void runDiscovery(config.scanRoots);
  }, [loaded]);

  // Hooks first: the ids are all the hook needs, and they are known before the draft is.
  const scroller = useRef<HTMLDivElement>(null);
  const sectionIds = draft ? ["roots", "tracked", "discovered", "scanning", "agents", ...(config ? ["shared-config"] : [])] : [];
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
    void runDiscovery(scanRoots);
  };

  const enableCandidate = (candidate: RepoConfig) =>
    update({ repos: [...draft.repos, { ...candidate, enabled: true }].sort((x, y) => x.path.localeCompare(y.path)) });

  const save = async () => {
    setSaving(true);
    try {
      const saved = await api.saveConfig(draft);
      setDraft(saved);
      setDirty(false);
      setMessage({ kind: "ok", text: "Saved." });
      onSaved(saved);
      void runDiscovery(saved.scanRoots); // forgotten repos become candidates again
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
            <button type="button" class="btn" onClick={() => runDiscovery(draft.scanRoots)} disabled={discovering || draft.scanRoots.length === 0}>
              {discovering ? "Discovering…" : "Rediscover"}
            </button>
          </div>
          {discoverErrors.map((e) => (
            <div class="notice warn">
              {e.root}: {e.message}
            </div>
          ))}
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
                  {repo.path}
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
      content: (
        <section class="panel">
          <h2>Discovered · {newCandidates.length} not tracked{discovering ? " · discovering…" : ""}</h2>
          <p class="hint">Repositories found under the workspace roots. Enable the ones to track, then save.</p>
          <div class="list">
            {newCandidates.map((repo) => (
              <div class="item candidate" key={repo.id}>
                <span class="name">{repo.name}</span>
                <span class="path" title={repo.path}>
                  {repo.path}
                </span>
                <button type="button" class="btn sm" onClick={() => enableCandidate(repo)}>
                  Enable
                </button>
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
  ];

  return (
    <>
      <div class="settings-layout">
        <SettingsNav sections={sections} current={nav.current} onJump={nav.jump} />
        <div class="settings" ref={scroller}>
          <SettingsSections sections={sections} />
        </div>
      </div>
      <div class="savebar">
        <button type="button" class="btn primary" onClick={save} disabled={!dirty || saving}>
          {saving ? "Saving…" : "Save"}
        </button>
        {dirty && <span class="badge warn">unsaved changes</span>}
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
