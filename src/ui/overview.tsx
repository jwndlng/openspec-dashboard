import { useMemo, useState } from "preact/hooks";
import { boardColumns } from "../shared/columns.ts";
import type { Config, Snapshot, WorkInProgress } from "../shared/types.ts";
import { hasCheckoutInfo } from "./checkoutMarkers.ts";
import { NoRepos } from "./empty.tsx";
import { relTime } from "./format.ts";
import {
  filterRows,
  naturalDir,
  type OverviewLayout,
  type OverviewRow,
  type OverviewState,
  overviewRows,
  parseOverviewState,
  SORT_KEYS,
  type SortKey,
  serializeOverviewState,
  sortRows,
  checkoutSummary,
  monogram,
  toggleSort,
  wipIndicator,
} from "./overviewState.ts";
import { Stat } from "./band.tsx";
import { IconChevronDown, IconFolderGit, IconGitBranch, IconSearch, IconX } from "./icons.tsx";
import { assignRepoHues } from "./repoGroups.ts";
import { PullAllButton, PullButton } from "./pull.tsx";
import { branchNotice } from "./pullState.ts";
import { repoPath } from "./routes.ts";
import { summarize } from "./sharedConfigState.ts";
import { currentQuery, href, navigate, replaceQuery } from "./url.ts";

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

function lastUpdated(row: OverviewRow, now: number): string {
  return row.lastUpdatedAt ? `${relTime(row.lastUpdatedAt, now)} ago`.replace("just now ago", "just now") : "—";
}

function Row({ row, stages, now }: { row: OverviewRow; stages: string[]; now: number }) {
  const idle = row.open === 0;
  return (
    <tr class={idle ? "idle" : ""} title={`${row.path} · ${row.archived} archived`} onClick={openOnPlainClick(row)}>
      <th scope="row" class="repo-name">
        <RepoLink row={row} />
        {row.hint && <span class="path-hint mono">{row.hint}/</span>}
        <RepoBadges row={row} />
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
      <td class="wip-cell">
        <WipIndicator summary={row.workInProgress} />
      </td>
      <td class="when" title={row.lastUpdatedAt ?? "no activity date"}>
        {lastUpdated(row, now)}
      </td>
      <td class="row-actions">{row.isGit && row.ok && <PullButton repoId={row.id} compact />}</td>
    </tr>
  );
}

/** A tile's checkouts as two counts; the full list is in the tooltip and on the repository board. */
function TileCheckouts({ row }: { row: OverviewRow }) {
  if (!hasCheckoutInfo(row.worktrees)) {
    return (
      <div class="checkouts">
        <span class="none">no checkout details</span>
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
    </div>
  );
}

/**
 * Everything a row shows, plus the room a row lacks: one chip per checkout. Every tile has the same size and places its
 * parts in the same spots; the badge and checkout areas scroll inside the tile instead of growing it.
 */
function Tile({ row, stages, now, hue }: { row: OverviewRow; stages: string[]; now: number; hue?: number }) {
  const idle = row.open === 0;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is a pointer shortcut, as on a table row; the keyboard path is the repository link inside
    <article class={`tile ${idle ? "idle" : ""}`} title={`${row.path} · ${row.archived} archived`} onClick={openOnPlainClick(row)}>
      <header class="tile-head">
        <span class={`monogram ${hue === undefined ? "" : "repo-tint"}`} style={hue === undefined ? undefined : { "--repo-hue": hue }} aria-hidden="true">
          {monogram(row.name)}
        </span>
        <div class="tile-title">
          <h2 class="repo-name">
            <RepoLink row={row} />
            {row.hint && <span class="path-hint mono">{row.hint}/</span>}
          </h2>
          <span class="when" title={row.lastUpdatedAt ?? "no activity date"}>
            updated {lastUpdated(row, now)}
          </span>
        </div>
        {row.isGit && row.ok && <PullButton repoId={row.id} compact />}
      </header>
      <div class="tile-badges">
        <RepoBadges row={row} />
        <WipIndicator summary={row.workInProgress} />
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
      <TileCheckouts row={row} />
    </article>
  );
}

export function Overview({ snapshot, config }: { snapshot: Snapshot | null; config: Config | null }) {
  const [state, setStateRaw] = useState<OverviewState>(() => parseOverviewState(currentQuery()));
  const now = Date.now();

  const setState = (next: OverviewState) => {
    setStateRaw(next);
    replaceQuery(serializeOverviewState(next));
  };

  const rows = useMemo(() => (snapshot ? overviewRows(snapshot) : []), [snapshot]);
  // Same stage columns, in the same order, as the combined board.
  const stages = useMemo(() => (snapshot ? boardColumns(snapshot).filter((c) => c !== "Archived") : []), [snapshot]);
  const visible = useMemo(() => sortRows(filterRows(rows, state.q, state.wip), state.sort, state.dir), [rows, state]);
  // Over every repository, as on the board, so a tile's colour matches its cards and group headers.
  const hues = useMemo(() => assignRepoHues((snapshot?.repos ?? []).map((r) => r.id)), [snapshot]);

  if (snapshot && rows.length === 0) return <NoRepos config={config} />;
  const toArchive = rows.reduce((n, r) => n + r.toArchive, 0);

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
      </div>
      <div class="overview">
        {state.view === "tiles" ? (
          <div class="tiles">
            {visible.map((row) => (
              <Tile key={row.id} row={row} stages={stages} now={now} hue={hues.get(row.id)} />
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
                {header("wip", SORT_LABEL.wip)}
                {header("updated", SORT_LABEL.updated, "when")}
                <th scope="col" class="row-actions">
                  <span class="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <Row key={row.id} row={row} stages={stages} now={now} />
              ))}
            </tbody>
          </table>
        )}
        {snapshot && visible.length === 0 && <p class="hint">{state.q.trim() ? `No repository matches “${state.q}”${state.wip ? " with work in progress" : ""}.` : "No repository has uncommitted, unpushed or stale work."}</p>}
      </div>
    </>
  );
}
