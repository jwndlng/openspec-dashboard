import { useMemo, useState } from "preact/hooks";
import { boardColumns } from "../shared/columns.ts";
import type { Config, Snapshot, WorkInProgress } from "../shared/types.ts";
import { CheckoutChips } from "./checkout.tsx";
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
  toggleSort,
  wipIndicator,
} from "./overviewState.ts";
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

/** Everything a row shows, plus the room a row lacks: one chip per checkout. */
function Tile({ row, stages, now }: { row: OverviewRow; stages: string[]; now: number }) {
  const idle = row.open === 0;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is a pointer shortcut, as on a table row; the keyboard path is the repository link inside
    <article class={`tile ${idle ? "idle" : ""}`} title={`${row.path} · ${row.archived} archived`} onClick={openOnPlainClick(row)}>
      <header>
        <h2 class="repo-name">
          <RepoLink row={row} />
          {row.hint && <span class="path-hint mono">{row.hint}/</span>}
        </h2>
        <span class="when" title={row.lastUpdatedAt ?? "no activity date"}>
          {lastUpdated(row, now)}
        </span>
        {row.isGit && row.ok && <PullButton repoId={row.id} compact />}
      </header>
      <div class="tile-badges">
        <RepoBadges row={row} />
        <WipIndicator summary={row.workInProgress} />
      </div>
      {idle ? (
        <p class="none">no open changes</p>
      ) : (
        <>
          <ol class="stage-strip" aria-label="Open changes per stage">
            {stages.map((s) => (
              <li key={s} class={row.stageCounts[s] ? "" : "zero"} title={`${row.stageCounts[s] ?? 0} in ${s}`}>
                <span class="n">{row.stageCounts[s] ?? 0}</span>
                <span class="label">{s}</span>
              </li>
            ))}
          </ol>
          <div class="totals">
            <span>
              <span class="total">{row.open}</span> open
            </span>
            {row.toArchive > 0 && <span class="badge warning">{row.toArchive} to archive</span>}
          </div>
        </>
      )}
      {hasCheckoutInfo(row.worktrees) && (
        <div class="checkouts">
          <CheckoutChips checkouts={row.worktrees} />
        </div>
      )}
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

  if (snapshot && rows.length === 0) return <NoRepos config={config} />;

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
      <div class="filters">
        <div class="group">
          <input class="input" type="search" placeholder="Search repository…" value={state.q} onInput={(e) => setState({ ...state, q: e.currentTarget.value })} />
          <button
            type="button"
            class={`chip ${state.wip ? "on" : ""}`}
            aria-pressed={state.wip}
            title="Only repositories with uncommitted changes, unpushed commits or stale worktrees"
            onClick={() => setState({ ...state, wip: !state.wip })}
          >
            Work in progress
          </button>
        </div>
        <div class="group">
          {(["table", "tiles"] as OverviewLayout[]).map((view) => (
            <button key={view} type="button" class={`chip ${state.view === view ? "on" : ""}`} aria-pressed={state.view === view} onClick={() => setState({ ...state, view })}>
              {view === "table" ? "Table" : "Tiles"}
            </button>
          ))}
        </div>
        {/* The table sorts through its column headers; tiles have none. */}
        {state.view === "tiles" && (
          <div class="group">
            <label for="overview-sort">Sort</label>
            <select id="overview-sort" class="input" value={state.sort} onChange={(e) => setState({ ...state, sort: e.currentTarget.value as SortKey, dir: naturalDir(e.currentTarget.value as SortKey) })}>
              {SORT_KEYS.map((key) => (
                <option key={key} value={key}>
                  {SORT_LABEL[key]}
                </option>
              ))}
            </select>
            <button type="button" class="chip" title="Reverse the sort direction" onClick={() => setState(toggleSort(state, state.sort))}>
              {state.dir === "asc" ? "▲ ascending" : "▼ descending"}
            </button>
          </div>
        )}
        <span class="spacer" style={{ flex: 1 }} />
        <PullAllButton repoIds={rows.filter((r) => r.isGit && r.ok).map((r) => r.id)} />
        <span class="badge mono">
          {rows.length} tracked · {rows.reduce((n, r) => n + r.open, 0)} open · {rows.reduce((n, r) => n + r.toArchive, 0)} to archive
        </span>
      </div>
      <div class="overview">
        {state.view === "tiles" ? (
          <div class="tiles">
            {visible.map((row) => (
              <Tile key={row.id} row={row} stages={stages} now={now} />
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
