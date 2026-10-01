import { useEffect, useRef, useState } from "preact/hooks";
import { nameHints } from "../shared/nameHints.ts";
import type { Config, DiscoveredRepo, DiscoverResult, IntegratableRepo, RepoConfig, Snapshot } from "../shared/types.ts";
import { AgentSettings } from "./agentSettings.tsx";
import { api, ApiError } from "./api.ts";
import { EnvironmentPanel } from "./environment.tsx";
import { environmentAttention, environmentCount, type EnvironmentState } from "./environmentState.ts";
import { SettingsNav, type SettingsSection, SettingsSections, useSectionNav } from "./settingsNav.tsx";
import { SharedConfigPanel } from "./sharedConfig.tsx";
import { followInApp, href } from "./url.ts";

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

  const loaded = config !== null;
  useEffect(() => {
    if (config && config.scanRoots.length > 0) void runDiscovery(config.scanRoots, config.ignorePaths);
  }, [loaded]);

  // Hooks first: the ids are all the hook needs, and they are known before the draft is.
  const scroller = useRef<HTMLDivElement>(null);
  const sectionIds = draft ? ["roots", "tracked", "scanning", "agents", ...(config ? ["shared-config"] : []), "environment"] : [];
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

  // Discovery here only answers "what is under these roots": the repositories themselves are listed, enabled and
  // integrated on the projects overview. Anything already in the draft is not untracked any more.
  const draftIds = new Set(draft.repos.map((r) => r.id));
  const untrackedCandidates = candidates.filter((c) => !draftIds.has(c.id)).length;
  const untrackedIntegratable = integratable.filter((r) => !draftIds.has(r.id)).length;
  const enabledCount = draft.repos.filter((r) => r.enabled).length;
  const hints = nameHints(draft.repos);
  const hintBadge = (id: string) => {
    const hint = hints.get(id);
    return hint ? <span class="badge mono" title="another tracked repository has the same name">{hint}</span> : null;
  };

  // One list drives both the navigation and the page, so a panel cannot exist without its navigation entry.
  const sections: SettingsSection[] = [
    {
      id: "roots",
      label: "Workspace roots",
      content: (
        <section class="panel">
          <h2>Workspace roots</h2>
          <p class="hint">Directories to search (4 levels deep) for repositories containing <code>openspec/config.yaml</code>. Discovery runs whenever the roots change and only previews what it finds — nothing is tracked until you enable it on Projects.</p>
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
          {draft.scanRoots.length > 0 && (
            <p class="hint found-summary" aria-live="polite">
              {discovering ? "Discovering…" : discovered ? <FoundSummary candidates={untrackedCandidates} integratable={untrackedIntegratable} /> : null}
            </p>
          )}
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
          <p class="hint">Only enabled repositories are scanned and shown on the board. Names are display-only. Forgetting (×) a repository returns it to the Untracked &amp; disabled list on Projects.</p>
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
            {draft.repos.length === 0 && <span class="hint">Nothing tracked yet — enable discovered repositories on Projects.</span>}
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

/** The Workspace roots section's answer to "what did discovery find": counts and the way to Projects, never a list. */
export function FoundSummary({ candidates, integratable }: { candidates: number; integratable: number }) {
  if (candidates === 0 && integratable === 0) return <>Every repository under these roots is tracked.</>;
  const parts = [candidates > 0 ? `${candidates} using OpenSpec` : "", integratable > 0 ? `${integratable} without OpenSpec` : ""].filter(Boolean);
  return (
    <>
      Found {parts.join(" and ")}, not tracked yet —{" "}
      <a href={href("/")} onClick={(e) => followInApp(e, "/")}>
        enable or integrate them on Projects
      </a>
      . Save first if you changed the roots.
    </>
  );
}
