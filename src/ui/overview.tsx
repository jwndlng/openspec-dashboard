import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { boardColumns } from "../shared/columns.ts";
import { integrateUnavailable, type Config, type RepoConfig, type Snapshot, type WorkInProgress } from "../shared/types.ts";
import { api } from "./api.ts";
import { hasCheckoutInfo } from "./checkoutMarkers.ts";
import { createDiscoveryStore, type DiscoveryState } from "./discoveryState.ts";
import { NewProjectButton } from "./newProject.tsx";
import { relTime } from "./format.ts";
import {
  filterRows,
  hintAcross,
  isLabelActive,
  labelOptions,
  matchesSearch,
  naturalDir,
  type OverviewLayout,
  type OverviewRow,
  type OverviewState,
  overviewRows,
  parseOverviewState,
  type PendingRow,
  pendingRows,
  SORT_KEYS,
  type SortKey,
  serializeOverviewState,
  sortRows,
  checkoutSummary,
  monogram,
  ROW_LABEL_LIMIT,
  toggleLabel,
  toggleSort,
  untrackedEntries,
  wipIndicator,
} from "./overviewState.ts";
import { Stat } from "./band.tsx";
import { IconChevronDown, IconFolderGit, IconGitBranch, IconSearch, IconX } from "./icons.tsx";
import { LabelChips } from "./labels.tsx";
import { assignRepoHues } from "./repoGroups.ts";
import { AgentPicker, AgentToggle, LabelsButton, RenameButton, RenameField, RepoLabelsDialog } from "./projectSettings.tsx";
import { PullAllButton, PullButton } from "./pull.tsx";
import { OpenPrCount } from "./pullRequests.tsx";
import { branchNotice } from "./pullState.ts";
import { repoPath } from "./routes.ts";
import { useSessionUi } from "./sessions.tsx";
import { summarize } from "./sharedConfigState.ts";
import { DisableButton, type Tracking, UnmanagedSection, useTracking } from "./untracked.tsx";
import { currentQuery, followInApp, href, hrefWithQuery, navigate, replaceQuery } from "./url.ts";

/** Plain left-click only, so modifier-clicks and text selection keep their browser behaviour. */
function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

const SORT_LABEL: Record<SortKey, string> = { name: "Repository", open: "Open", archive: "To archive", wip: "Work in progress", updated: "Last updated" };

/** Text, not colour alone: a warning badge when something needs attention, plain subtle text for clean worktrees, nothing otherwise. */
function WipIndicator({ summary }: { summary?: WorkInProgress }) {
  const indicator = wipIndicator(summary);
  if (!indicator) return null;
  return (
    <span
      class={indicator.warn ? "badge warning wip" : "wip plain"}
      title="Checkouts of this repository: linked worktrees, and how many checkouts hold uncommitted changes, unpushed commits or are stale. Unpushed counts reflect the last fetch — the dashboard never fetches."
    >
      {indicator.text}
    </span>
  );
}

/** Shared by rows and tiles: a real link that navigates in place on a plain click. */
function RepoLink({ row }: { row: OverviewRow }) {
  const path = repoPath(row.id);
  return (
    <a
      class="repo-link"
      href={href(path)}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        e.stopPropagation();
        navigate(path);
      }}
    >
      {row.name}
    </a>
  );
}

/** Whole-row and whole-tile navigation; selecting text or modifier-clicking does nothing. */
function openOnPlainClick(row: OverviewRow) {
  return (e: MouseEvent) => {
    if (!isPlainClick(e) || getSelection()?.toString()) return;
    navigate(repoPath(row.id));
  };
}

function RepoBadges({ row }: { row: OverviewRow }) {
  // Profile ids rather than names: they are readable slugs and need no extra request here.
  const shared = summarize(row.sharedConfig, []);
  const notice = branchNotice(row);
  return (
    <>
      {shared && (
        <span class={shared.level === "ok" ? "path-hint" : `badge ${shared.level}`} title="Shared OpenSpec config profiles carried by openspec/config.yaml">
          ⚙ {shared.text}
        </span>
      )}
      {!row.ok && (
        <span class="badge danger" title={row.error}>
          ⚠ scan failed
        </span>
      )}
      {notice && (
        <span class="badge warning" title={notice.long}>
          ⎇ {notice.short}
        </span>
      )}
    </>
  );
}

/** Rows and tiles toggle the overview's label filter through their chips. */
export interface LabelFilter {
  isActive: (label: string) => boolean;
  onToggle: (label: string) => void;
}

function lastUpdated(row: OverviewRow, now: number): string {
  return row.lastUpdatedAt ? `${relTime(row.lastUpdatedAt, now)} ago`.replace("just now ago", "just now") : "—";
}

/**
 * The project's name, or the field renaming it; the pencil beside it. Without a config entry (the config is still
 * loading) only the name, as before.
 */
function RepoNameEdit({ row, repo, tracking }: { row: OverviewRow; repo?: RepoConfig; tracking: Tracking }) {
  if (repo && tracking.renaming === row.id) return <RenameField id={row.id} name={repo.name} tracking={tracking} />;
  return (
    <>
      <RepoLink row={row} />
      {repo && <RenameButton id={row.id} name={repo.name} tracking={tracking} />}
    </>
  );
}

/** The project's agent-session switch and, when there is a choice, its agent. */
function AgentControls({ repo, config, tracking }: { repo?: RepoConfig; config?: Config | null; tracking: Tracking }) {
  if (!repo || !config) return null;
  return (
    <span class="agent-controls">
      <AgentToggle repo={repo} config={config} tracking={tracking} />
      <AgentPicker repo={repo} config={config} tracking={tracking} />
    </span>
  );
}

/** What a row or tile needs to offer the project's own settings: its entry in the saved config. */
export interface ProjectSettingsProps {
  config?: Config | null;
}

const repoOf = (config: Config | null | undefined, id: string) => config?.repos.find((r) => r.id === id);

export function Row({ row, stages, now, tracking, labelFilter, config }: { row: OverviewRow; stages: string[]; now: number; tracking: Tracking; labelFilter?: LabelFilter } & ProjectSettingsProps) {
  const idle = row.open === 0;
  const repo = repoOf(config, row.id);
  return (
    <tr class={idle ? "idle" : ""} title={`${row.path} · ${row.archived} archived`} onClick={openOnPlainClick(row)}>
      <th scope="row" class="repo-name">
        <RepoNameEdit row={row} repo={repo} tracking={tracking} />
        {row.hint && <span class="path-hint mono">{row.hint}/</span>}
        <RepoBadges row={row} />
        <LabelChips labels={row.labels} limit={ROW_LABEL_LIMIT} isActive={labelFilter?.isActive} onToggle={labelFilter?.onToggle} />
      </th>
      {idle ? (
        <td class="none" colSpan={stages.length + 2}>
          no open changes
        </td>
      ) : (
        <>
          {stages.map((s) => (
            <td key={s} class="num">
              {row.stageCounts[s] ?? <span class="zero">·</span>}
            </td>
          ))}
          <td class="num total">{row.open}</td>
          <td class="num">{row.toArchive > 0 ? <span class="badge warning">{row.toArchive} to archive</span> : <span class="zero">·</span>}</td>
        </>
      )}
      {/* Cached only: the overview never contacts GitHub. The figure links to the Pull requests view. */}
      <td class="num pr-cell">
        <OpenPrCount repoId={row.id} />
      </td>
      <td class="wip-cell">
        <WipIndicator summary={row.workInProgress} />
      </td>
      <td class="when" title={row.lastUpdatedAt ?? "no activity date"}>
        {lastUpdated(row, now)}
      </td>
      <td class="agent-cell">
        <AgentControls repo={repo} config={config} tracking={tracking} />
      </td>
      <td class="row-actions">
        {row.isGit && row.ok && <PullButton repoId={row.id} repoName={row.name} compact />}
        {repo && <LabelsButton id={row.id} name={repo.name} tracking={tracking} />}
        <DisableButton id={row.id} name={row.name} tracking={tracking} />
      </td>
    </tr>
  );
}

/** A repository enabled a moment ago: in the list at once, with its counts once the scan that includes it is done. */
export function PendingTableRow({ row, columns }: { row: PendingRow; columns: number }) {
  return (
    <tr class="pending" title={row.path}>
      <th scope="row" class="repo-name">
        <span class="pending-name">{row.name}</span>
        {row.hint && <span class="path-hint mono">{row.hint}/</span>}
      </th>
      <td class="none" colSpan={columns}>
        Scanning…
      </td>
    </tr>
  );
}

export function PendingTile({ row }: { row: PendingRow }) {
  return (
    <article class="tile idle pending" title={row.path}>
      <header class="tile-head">
        <span class="monogram" aria-hidden="true">
          {monogram(row.name)}
        </span>
        <div class="tile-title">
          <h2 class="repo-name">
            <span class="pending-name">{row.name}</span>
            {row.hint && <span class="path-hint mono">{row.hint}/</span>}
          </h2>
        </div>
      </header>
      <p class="tile-body none">Scanning…</p>
    </article>
  );
}

/** In place of the managed projects while nothing is enabled; the Unmanaged projects section follows below it. */
export function NothingTracked({ config }: { config: Config | null }) {
  return (
    <div class="empty inline">
      <h3 class="nothing-tracked-title">No repositories tracked yet</h3>
      <p>Enable one of the unmanaged projects below, or add a workspace root in Settings to discover more.</p>
      <div class="row actions">
        <a class="btn" href={hrefWithQuery("/settings", "?section=roots")} onClick={(e) => followInApp(e, "/settings", "?section=roots")}>
          Open Settings
        </a>
        <NewProjectButton config={config} small={false} />
      </div>
    </div>
  );
}

/** A tile's checkouts as two counts; the full list is in the tooltip and on the repository board. */
function TileCheckouts({ row, children }: { row: OverviewRow; children?: ComponentChildren }) {
  if (!hasCheckoutInfo(row.worktrees)) {
    return (
      <div class="checkouts">
        <span class="none">no checkout details</span>
        {children}
      </div>
    );
  }
  const summary = checkoutSummary(row.worktrees);
  return (
    <div class="checkouts" title={summary.detail}>
      <span class="checkout-count">
        <IconFolderGit />
        <strong>{summary.worktrees}</strong> {summary.worktrees === 1 ? "worktree" : "worktrees"}
      </span>
      <span class="checkout-count">
        <IconGitBranch />
        <strong>{summary.branches}</strong> {summary.branches === 1 ? "branch" : "branches"} active
      </span>
      {children}
    </div>
  );
}

/**
 * Everything a row shows, plus the room a row lacks: one chip per checkout. Every tile has the same size and places its
 * parts in the same spots; the badge and checkout areas scroll inside the tile instead of growing it.
 */
export function Tile({ row, stages, now, hue, tracking, labelFilter, config }: { row: OverviewRow; stages: string[]; now: number; hue?: number; tracking: Tracking; labelFilter?: LabelFilter } & ProjectSettingsProps) {
  const idle = row.open === 0;
  const repo = repoOf(config, row.id);
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is a pointer shortcut, as on a table row; the keyboard path is the repository link inside
    <article class={`tile ${idle ? "idle" : ""}`} title={`${row.path} · ${row.archived} archived`} onClick={openOnPlainClick(row)}>
      <header class="tile-head">
        <span class={`monogram ${hue === undefined ? "" : "repo-tint"}`} style={hue === undefined ? undefined : { "--repo-hue": hue }} aria-hidden="true">
          {monogram(row.name)}
        </span>
        <div class="tile-title">
          <h2 class="repo-name">
            <RepoNameEdit row={row} repo={repo} tracking={tracking} />
            {row.hint && <span class="path-hint mono">{row.hint}/</span>}
          </h2>
          <span class="when" title={row.lastUpdatedAt ?? "no activity date"}>
            updated {lastUpdated(row, now)}
          </span>
        </div>
        <span class="tile-actions">
          {row.isGit && row.ok && <PullButton repoId={row.id} repoName={row.name} compact />}
          {repo && <LabelsButton id={row.id} name={repo.name} tracking={tracking} />}
          <DisableButton id={row.id} name={row.name} tracking={tracking} />
        </span>
      </header>
      <div class="tile-badges">
        <RepoBadges row={row} />
        <WipIndicator summary={row.workInProgress} />
        {/* In the badge area, which wraps and scrolls inside the tile, so every tile keeps one size. */}
        <LabelChips labels={row.labels} isActive={labelFilter?.isActive} onToggle={labelFilter?.onToggle} />
      </div>
      <div class="tile-prs">
        <OpenPrCount repoId={row.id} compact />
        <span class="label">open PRs</span>
      </div>
      {idle ? (
        <p class="tile-body none">no open changes</p>
      ) : (
        <div class="tile-body">
          <div class="tile-totals">
            <span class="big">
              <span class="n">{row.open}</span> open
            </span>
            <span class={`big ${row.toArchive > 0 ? "success" : "zero"}`}>
              <span class="n">{row.toArchive}</span> to archive
            </span>
          </div>
          <ol class="stage-strip" aria-label="Open changes per stage">
            {stages.map((s) => (
              <li key={s} class={row.stageCounts[s] ? "" : "zero"} title={`${row.stageCounts[s] ?? 0} in ${s}`}>
                <span class="n">{row.stageCounts[s] ?? 0}</span>
                <span class="label">{s}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
      <TileCheckouts row={row}>
        <AgentControls repo={repo} config={config} tracking={tracking} />
      </TileCheckouts>
    </article>
  );
}

/** The overview's discovery runs, kept across visits: coming back shows the last result while a new run is under way. */
const discovery = createDiscoveryStore(() => api.discover());

function useDiscovery(): DiscoveryState {
  const [state, setState] = useState(discovery.get());
  useEffect(() => discovery.subscribe(() => setState(discovery.get())), []);
  return state;
}

function toggleLabelsOff(state: OverviewState): OverviewState {
  const { labels: _labels, ...rest } = state;
  return rest;
}

/** Why nothing is listed, in the words of the filters that are on. */
export function noMatch(state: OverviewState): string {
  const parts: string[] = [];
  if (state.q.trim()) parts.push(`matches “${state.q}”`);
  if (state.labels?.length) parts.push(`displays ${state.labels.map((l) => `“${l}”`).join(" and ")}`);
  if (state.wip) parts.push("has uncommitted, unpushed or stale work");
  return parts.length ? `No repository ${parts.join(" and ")}.` : "No repository to show.";
}

export function Overview({ snapshot, config, onConfig }: { snapshot: Snapshot | null; config: Config | null; onConfig: (config: Config) => void }) {
  const [state, setStateRaw] = useState<OverviewState>(() => parseOverviewState(currentQuery()));
  const now = Date.now();

  const setState = (next: OverviewState) => {
    setStateRaw(next);
    replaceQuery(serializeOverviewState(next));
  };

  const rows = useMemo(() => (snapshot ? overviewRows(snapshot, config) : []), [snapshot, config]);
  const discovered = useDiscovery();
  const ui = useSessionUi();
  const hasRoots = (config?.scanRoots.length ?? 0) > 0;
  const configRef = useRef(config);
  configRef.current = config;
  // A discovery run is also when the server notices a finished integration and tracks the repository, so the config is
  // read again afterwards; only a real difference reaches the app shell.
  const rediscover = () => {
    if (!hasRoots) return discovery.clear();
    void discovery.run().then(async () => {
      const latest = await api.config().catch(() => undefined);
      if (latest && JSON.stringify(latest) !== JSON.stringify(configRef.current)) onConfig(latest);
    });
  };
  const tracking = useTracking({ onConfig, rediscover });
  // Against the saved roots and ignore paths, whenever the overview opens or they change (a save in Settings).
  const rootsKey = config ? JSON.stringify([config.scanRoots, config.ignorePaths]) : undefined;
  useEffect(() => {
    if (rootsKey !== undefined) rediscover();
  }, [rootsKey]);
  // An integration that stopped running may have left `openspec/config.yaml` behind: look again.
  const runningIntegrations = ui.integrations.filter((s) => s.state === "running").length;
  const wasRunning = useRef(runningIntegrations);
  useEffect(() => {
    if (runningIntegrations < wasRunning.current && rootsKey !== undefined) rediscover();
    wasRunning.current = runningIntegrations;
  }, [runningIntegrations]);
  const pending = pendingRows(config, snapshot);
  const untracked = untrackedEntries(config, discovered.result);
  hintAcross(rows, pending, untracked);
  // Same stage columns, in the same order, as the combined board.
  const stages = useMemo(() => (snapshot ? boardColumns(snapshot).filter((c) => c !== "Archived") : []), [snapshot]);
  const visible = sortRows(filterRows(rows, state.q, state.wip, state.labels), state.sort, state.dir);
  const labelFilter: LabelFilter = { isActive: (label) => isLabelActive(state, label), onToggle: (label) => setState(toggleLabel(state, label)) };
  const labelChoices = labelOptions(rows, state.labels);
  const labelsActive = (state.labels?.length ?? 0) > 0;
  // Over every repository, as on the board, so a tile's colour matches its cards and group headers.
  const hues = useMemo(() => assignRepoHues((snapshot?.repos ?? []).map((r) => r.id)), [snapshot]);

  const toArchive = rows.reduce((n, r) => n + r.toArchive, 0);
  // Nothing pending or untracked has work in progress or labels to show, so those filters hide both.
  const pendingShown = state.wip || labelsActive ? [] : pending.filter((r) => matchesSearch(r, state.q));
  const untrackedShown = untracked.filter((e) => matchesSearch(e, state.q));
  const nothingTracked = snapshot !== null && rows.length === 0 && pending.length === 0;
  const labelsRepo = tracking.labelsOpen ? repoOf(config, tracking.labelsOpen) : undefined;
  const runningIntegration = (path: string) => ui.integrations.find((s) => s.folder === path && s.state === "running")?.id;

  const header = (key: SortKey, label: string, cls = "") => {
    const active = state.sort === key;
    return (
      <th scope="col" class={cls} aria-sort={active ? (state.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" class={`sort ${active ? "on" : ""}`} onClick={() => setState(toggleSort(state, key))}>
          {label}
          <span aria-hidden="true">{active ? (state.dir === "asc" ? " ▲" : " ▼") : ""}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div class="band">
        <div class="band-main">
          <div class="row band-title">
            <h1>
              Projects
              <span class="band-sub">tracked OpenSpec repositories</span>
            </h1>
            <span class="divider" aria-hidden="true" />
            <span class="stats">
              <Stat label="Tracked" value={rows.length} />
              <Stat label="Open" value={rows.reduce((n, r) => n + r.open, 0)} />
              <Stat label="To archive" value={toArchive} tone={toArchive > 0 ? "success" : undefined} />
            </span>
          </div>
        </div>
        <div class="band-actions">
          <NewProjectButton config={config} />
          <PullAllButton repoIds={rows.filter((r) => r.isGit && r.ok).map((r) => r.id)} />
        </div>
      </div>
      <div class="filterbar">
        <div class="filterbar-row">
          <label class="search">
            <IconSearch />
            <input class="input" type="search" placeholder="Search repository…" aria-label="Search repository" value={state.q} onInput={(e) => setState({ ...state, q: e.currentTarget.value })} />
            {state.q && (
              <button type="button" class="search-clear" aria-label="Clear search" onClick={() => setState({ ...state, q: "" })}>
                <IconX size={12} />
              </button>
            )}
          </label>
          <button
            type="button"
            class={`control switch-control ${state.wip ? "on" : ""}`}
            aria-pressed={state.wip}
            title="Only repositories with uncommitted changes, unpushed commits or stale worktrees"
            onClick={() => setState({ ...state, wip: !state.wip })}
          >
            <span class="switch" aria-hidden="true" />
            Work in progress
          </button>
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want */}
          <div class="segmented" role="group" aria-label="Layout">
            {(["table", "tiles"] as OverviewLayout[]).map((view) => (
              <button key={view} type="button" class={state.view === view ? "on" : ""} aria-pressed={state.view === view} onClick={() => setState({ ...state, view })}>
                {view === "table" ? "Table" : "Tiles"}
              </button>
            ))}
          </div>
          {/* The table sorts through its column headers; tiles have none. */}
          {state.view === "tiles" && (
            <>
              <label class="control select-control" for="overview-sort">
                <span>Sort</span>
                <select id="overview-sort" value={state.sort} onChange={(e) => setState({ ...state, sort: e.currentTarget.value as SortKey, dir: naturalDir(e.currentTarget.value as SortKey) })}>
                  {SORT_KEYS.map((key) => (
                    <option key={key} value={key}>
                      {SORT_LABEL[key]}
                    </option>
                  ))}
                </select>
                <IconChevronDown size={12} />
              </label>
              <button type="button" class="control" title="Reverse the sort direction" onClick={() => setState(toggleSort(state, state.sort))}>
                {state.dir === "asc" ? "▲ ascending" : "▼ descending"}
              </button>
            </>
          )}
          <span class="spacer" />
          <span class="showing">
            Showing <strong>{visible.length}</strong> of {rows.length}
          </span>
        </div>
        {labelChoices.length > 0 && (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want
          <div class="filterbar-row label-filter" role="group" aria-label="Filter by label">
            <span class="label-filter-title">Labels</span>
            {labelChoices.map((option) => {
              const active = isLabelActive(state, option.label);
              return (
                <button
                  key={option.label}
                  type="button"
                  class={`label-chip ${active ? "on" : ""} ${option.count === 0 ? "unmatched" : ""}`}
                  aria-pressed={active}
                  title={option.count === 0 ? "No repository displays this label" : `${option.count} ${option.count === 1 ? "repository" : "repositories"}`}
                  onClick={() => setState(toggleLabel(state, option.label))}
                >
                  {option.label}
                  <span class="label-count">{option.count}</span>
                </button>
              );
            })}
            {labelsActive && (
              <button type="button" class="btn sm ghost" onClick={() => setState(toggleLabelsOff(state))}>
                Clear labels
              </button>
            )}
          </div>
        )}
      </div>
      <div class="overview">
        <header class="overview-section-head">
          <h2 class="overview-section-title">
            Managed projects <span class="untracked-count">· {rows.length + pending.length}</span>
          </h2>
        </header>
        {nothingTracked ? (
          <NothingTracked config={config} />
        ) : state.view === "tiles" ? (
          <div class="tiles">
            {pendingShown.map((row) => (
              <PendingTile key={row.id} row={row} />
            ))}
            {visible.map((row) => (
              <Tile key={row.id} row={row} stages={stages} now={now} hue={hues.get(row.id)} tracking={tracking} labelFilter={labelFilter} config={config} />
            ))}
          </div>
        ) : (
          <table class="projects">
            <thead>
              <tr>
                {header("name", SORT_LABEL.name)}
                {stages.map((s) => (
                  <th key={s} scope="col" class="num stage">
                    {s}
                  </th>
                ))}
                {header("open", SORT_LABEL.open, "num")}
                {header("archive", SORT_LABEL.archive, "num")}
                <th scope="col" class="num" title="Open pull requests from the last fetch; the overview never contacts GitHub">
                  PRs
                </th>
                {header("wip", SORT_LABEL.wip)}
                {header("updated", SORT_LABEL.updated, "when")}
                <th scope="col" class="agent-cell" title="Whether agent sessions can be started for the project, saved at once">
                  Agent sessions
                </th>
                <th scope="col" class="row-actions">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {pendingShown.map((row) => (
                <PendingTableRow key={row.id} row={row} columns={stages.length + 7} />
              ))}
              {visible.map((row) => (
                <Row key={row.id} row={row} stages={stages} now={now} tracking={tracking} labelFilter={labelFilter} config={config} />
              ))}
            </tbody>
          </table>
        )}
        {snapshot && !nothingTracked && visible.length === 0 && pendingShown.length === 0 && <p class="hint">{noMatch(state)}</p>}
        {labelsRepo && config && (
          <RepoLabelsDialog repo={labelsRepo} repos={config.repos} detected={snapshot?.repos.find((r) => r.id === labelsRepo.id)?.detectedLabels ?? []} tracking={tracking} />
        )}
        {!state.wip && !labelsActive && config && (
          <UnmanagedSection
            entries={untrackedShown}
            discovery={discovered}
            hasRoots={hasRoots}
            query={state.q}
            tracking={tracking}
            integrateOff={integrateUnavailable(config, ui.agents)}
            runningIntegration={runningIntegration}
            showIntegration={(id) => ui.showIntegration(id)}
            onRediscover={rediscover}
          />
        )}
      </div>
    </>
  );
}
