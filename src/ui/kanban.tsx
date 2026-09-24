import { useEffect, useMemo, useState } from "preact/hooks";
import { boardColumns, isComplete } from "../shared/columns.ts";
import type { ChangeSnapshot, Config, RepoSnapshot, Snapshot } from "../shared/types.ts";
import { NoRepos } from "./empty.tsx";
import { parseFilters, resolveLayout, serializeFilters, STACK_BELOW_PX, type Filters } from "./filters.ts";
import { FilterBar } from "./boardFilters.tsx";
import { Stat } from "./band.tsx";
import { BranchBadge, CheckoutSummaryButton } from "./checkout.tsx";
import { hasCheckoutInfo } from "./checkoutMarkers.ts";
import { CleanupButton } from "./cleanup.tsx";
import { NewChangeDialog } from "./newChangeForm.tsx";
import { PullButton } from "./pull.tsx";
import { branchNotice } from "./pullState.ts";
import { cdCommand, daysSince, relTime } from "./format.ts";
import { isMinimized, loadGroupState, saveGroupState, toggleGroup, type GroupOverrides } from "./groupState.ts";
import { assignRepoHues, groupByRepo, newChangeTargets, recentArchived } from "./repoGroups.ts";
import { columnKind } from "./boardMarks.ts";
import { IconChevronRight, IconPlus, IconTerminal } from "./icons.tsx";
import { SessionControls, useSessionUi } from "./sessions.tsx";
import { consoleAvailable } from "./sessionState.ts";
import { boardFrom, changePath, CONSOLE_TAB, repoPath, serializeDetailQuery } from "./routes.ts";
import { currentQuery, followInApp, href, navigate, replaceQuery } from "./url.ts";

const ARCHIVED_LIMIT = 25;

export interface Card extends ChangeSnapshot {
  repoName: string;
  repoPath: string;
  /** Repository hue from assignRepoHues; the theme turns it into a colour in CSS. */
  hue: number;
}

/** Sets --repo-hue for the `repo-tint` class. */
function repoHue(hue: number) {
  return { "--repo-hue": hue };
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(() => setDone(false), 1500);
    return () => clearTimeout(t);
  }, [done]);
  return (
    <button type="button"
      class={`btn sm ghost copy ${done ? "done" : ""}`}
      title={`Copy: ${text}`}
      onClick={() => navigator.clipboard.writeText(text).then(() => setDone(true))}
    >
      {done ? "Copied" : label}
    </button>
  );
}

/** What a progress bar counts: ticked tasks, or written artifacts while a change is in `Drafts`. */
export type MeterUnit = "tasks" | "artifacts";

export function meterText(done: number, total: number, unit: MeterUnit): string {
  return unit === "artifacts" ? `${done} of ${total} artifacts written` : `${done} of ${total} tasks complete`;
}

/** `showUnit` names what the bar counts in its visible value (`2/4 Artifacts`, `3/12 Tasks`); the card uses it. */
export function Meter({ done, total, unit = "tasks", showUnit = false }: { done: number; total: number; unit?: MeterUnit; showUnit?: boolean }) {
  const full = total > 0 && done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  const text = meterText(done, total, unit);
  return (
    <div class={`meter ${full ? "full" : ""}`} title={text} role="progressbar" aria-label={text} aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
      <div class="track">
        <div class="fill" style={{ width: `${pct}%` }} />
      </div>
      <span class={`value ${showUnit ? "unit" : ""}`} aria-hidden="true">
        {done}/{total}
        {showUnit && (unit === "artifacts" ? " Artifacts" : " Tasks")}
      </span>
    </div>
  );
}

/** The progress bar a card shows: written artifacts in `Drafts`, else ticked tasks when there are any, else none. */
export function cardProgress(card: Pick<Card, "stage" | "artifacts" | "tasks">): { done: number; total: number; unit: MeterUnit } | undefined {
  if (card.stage === "drafts") return { done: card.artifacts.filter((a) => a.status === "done").length, total: card.artifacts.length, unit: "artifacts" };
  if (card.stage === "backlog" || !card.tasks || card.tasks.total === 0) return undefined;
  return { ...card.tasks, unit: "tasks" };
}

/** Where a card leads: its change's detail view, remembering the board (`from`) it sits on. */
export function cardLink(card: Pick<Card, "repoId" | "name">, from: string): { path: string; query: string } {
  return { path: changePath(card.repoId, card.name), query: serializeDetailQuery({ raw: false, from }) };
}

/**
 * Only **Show details** navigates: the card itself and its change name are plain content, so clicking anywhere else on
 * a card does nothing. It is an anchor, so ⌘/middle-click opens the detail view in a new tab.
 */
export function ChangeCard({ card, now, from }: { card: Card; now: number; from: string }) {
  const noTasks = card.warnings?.includes("tasks file has no tasks");
  const progress = cardProgress(card);
  const link = cardLink(card, from);
  // Only what an overview needs: the name and the last update, under them its session state, progress, the next step.
  // Branch, worktree, work status, prompt and completed phases are in the detail view.
  return (
    <article class="card">
      <div class="card-top">
        <div class="card-title">
          <span class="name">{card.name}</span>
          <span class="age" title={card.lastActivityAt ? `last activity ${card.lastActivityAt}` : "no activity date"}>
            {card.archived ? `archived ${card.archived}` : `updated ${relTime(card.lastActivityAt, now)} ago`}
          </span>
        </div>
        <span class="card-status">
          <SessionControls card={card} part="status" />
          <ConsoleLink card={card} from={from} />
        </span>
      </div>
      {progress && <Meter {...progress} showUnit />}
      <div class="meta">
        {noTasks && <span class="badge warning">no tasks</span>}
        {card.warnings?.filter((w) => w !== "tasks file has no tasks").map((w) => (
          <span class="badge danger" title={w}>
            ⚠ error
          </span>
        ))}
        <SessionControls card={card} part="starters" />
        <a class="show-details" href={href(link.path, undefined, link.query)} onClick={(e) => followInApp(e, link.path, link.query)} aria-label={`Show details of ${card.name}`}>
          Show details
          <IconChevronRight size={12} />
        </a>
      </div>
    </article>
  );
}

/** Where the Console quick link leads: the change's detail view on its Console tab, remembering the board. */
export function consoleTarget(card: Pick<Card, "repoId" | "name">, from: string): { path: string; query: string } {
  return { path: changePath(card.repoId, card.name), query: serializeDetailQuery({ raw: false, from, artifact: CONSOLE_TAB }) };
}

/**
 * A quick way into the change's agent console: its detail view opened on the Console tab. Only when the change has a
 * session or a session worktree, which is when that tab exists.
 */
function ConsoleLink({ card, from }: { card: Card; from: string }) {
  const ui = useSessionUi();
  if (!consoleAvailable(ui.config, ui.sessions, ui.worktrees, card.repoId, card.name)) return null;
  const { path, query } = consoleTarget(card, from);
  return (
    <a class="console-link" href={href(path, undefined, query)} onClick={(e) => followInApp(e, path, query)} aria-label={`Open the agent console of ${card.name}`} title="Open the agent console">
      <IconTerminal size={14} />
    </a>
  );
}

/** The counts every board's band shows: open changes matching the filters, and complete changes waiting to be archived. */
function BoardStats({ open, toArchive }: { open: number; toArchive: number }) {
  return (
    <span class="stats">
      <Stat label="Open" value={open} />
      <Stat label="To archive" value={toArchive} tone={toArchive > 0 ? "success" : undefined} />
    </span>
  );
}

/** Minimize state for the groups of a board; owned by `Kanban`, consumed by every column. */
interface GroupControls {
  overrides: GroupOverrides;
  onToggle: (repoId: string, column: string) => void;
  /** A text search is active: show every group open so matches are never hidden, and leave stored choices alone. */
  forceExpanded: boolean;
}

// Cards of one column, grouped by repository in the same order in every column. On a single-repository
// board (`showRepo` false) the group header would only repeat the page header, so the cards render flat.
function RepoGroups({ column, cards, now, showRepo, from, groups: controls }: { column: string; cards: Card[]; now: number; showRepo: boolean; from: string; groups: GroupControls }) {
  const groups = useMemo(() => groupByRepo(cards), [cards]);
  if (!showRepo) {
    return (
      <div class="cards">
        {cards.map((c) => (
          <ChangeCard key={`${c.repoId}/${c.name}`} card={c} now={now} from={from} />
        ))}
      </div>
    );
  }
  return (
    <div class="cards">
      {groups.map((g) => {
        const expanded = controls.forceExpanded || !isMinimized(controls.overrides, g.repoId, column);
        const bodyId = `group-${column.replace(/[^A-Za-z0-9]+/g, "-")}-${g.repoId}`;
        return (
          <section key={g.repoId} class={`repo-group repo-tint ${expanded ? "" : "minimized"}`} style={repoHue(g.cards[0].hue)} aria-label={g.repoName}>
            <button
              type="button"
              class="repo-group-head"
              aria-expanded={expanded}
              aria-controls={bodyId}
              aria-disabled={controls.forceExpanded}
              title={controls.forceExpanded ? "expanded while searching" : expanded ? "minimize this group" : "expand this group"}
              onClick={() => !controls.forceExpanded && controls.onToggle(g.repoId, column)}
            >
              <span class="chevron" aria-hidden="true" />
              <span class="swatch" />
              <span class="name">{g.repoName}</span>
              <span class="count">{g.cards.length}</span>
            </button>
            {expanded && (
              <div class="repo-group-body" id={bodyId}>
                {g.cards.map((c) => (
                  <ChangeCard key={`${c.repoId}/${c.name}`} card={c} now={now} from={from} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** What each lifecycle column means. */
const COLUMN_HINT: Record<string, string> = {
  Backlog: "Created, no artifact written yet",
  Drafts: "Some artifacts written, not all of them yet",
  Ready: "Every artifact is written; no task ticked yet",
  Implementing: "At least one task ticked",
  Done: "All tasks complete; ready to archive",
  Archived: `Archived changes; the ${ARCHIVED_LIMIT} most recent are shown`,
};

/** Whether the window is narrower than the point where `auto` stacks the columns; follows resizes. */
function useNarrowWindow(): boolean {
  const query = `(max-width: ${STACK_BELOW_PX - 1}px)`;
  const [narrow, setNarrow] = useState(() => typeof matchMedia === "function" && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const media = matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, [query]);
  return narrow;
}

// `countLabel` replaces the card count in the header when the column shows only part of its cards (Archived).
function Column({ label, cards, now, hot, showRepo, from, countLabel, groups }: { label: string; cards: Card[]; now: number; hot?: boolean; showRepo: boolean; from: string; countLabel?: string; groups: GroupControls }) {
  return (
    <section class={`column ${cards.length === 0 ? "empty" : ""}`}>
      <div class="column-head">
        <span class="stage-dot" data-kind={columnKind(label)} aria-hidden="true" />
        <h2 title={COLUMN_HINT[label]}>{label}</h2>
        <span class={`count ${hot && cards.length ? "hot" : ""}`}>{countLabel ?? cards.length}</span>
      </div>
      <RepoGroups column={label} cards={cards} now={now} showRepo={showRepo} from={from} groups={groups} />
    </section>
  );
}

function RepoHeader({ repo, now, stats, onCreated }: { repo: RepoSnapshot; now: number; stats: { open: number; toArchive: number }; onCreated: () => void }) {
  const updated = repo.lastUpdatedAt ? relTime(repo.lastUpdatedAt, now) : undefined;
  const notice = branchNotice(repo);
  const [creating, setCreating] = useState(false);
  const canGit = repo.isGit && repo.ok;
  return (
    <div class="band repo-head">
      <div class="band-main">
        <div class="row band-title">
          <h1 class="crumbs">
            <a
              class="crumb-link"
              href={href("/")}
              onClick={(e) => {
                e.preventDefault();
                navigate("/");
              }}
            >
              Projects
            </a>
            <span class="sep">/</span>
            {repo.name}
          </h1>
          <span class="divider" aria-hidden="true" />
          <BoardStats open={stats.open} toArchive={stats.toArchive} />
        </div>
        {/* The repository's state: its checkouts, the config it carries and its age. Its actions have their own area. */}
        <div class="row status">
          {/* Snapshots cached by older versions know no checkouts: fall back to the current branch. */}
          {hasCheckoutInfo(repo.worktrees) ? <CheckoutSummaryButton checkouts={repo.worktrees} repoName={repo.name} /> : repo.currentBranch && <BranchBadge branch={repo.currentBranch} hint="current branch" />}
          {repo.sharedConfig?.unreadable && (
            <span class="badge danger" title="openspec/config.yaml is missing, not valid YAML, or has malformed shared-config markers">
              ⚙ config unreadable
            </span>
          )}
          {repo.sharedConfig?.applied.map((p) => (
            <span key={p.id} class={`badge ${p.state === "in-sync" ? "" : "warning"}`} title="Shared OpenSpec config profile carried by openspec/config.yaml">
              ⚙ {p.id}
              {p.state === "in-sync" ? "" : ` · ${p.state}`}
            </span>
          ))}
          {updated && (
            <span class="badge" title={repo.lastUpdatedAt}>
              updated {updated === "just now" ? updated : `${updated} ago`}
            </span>
          )}
        </div>
        <div class="row path">
          <code>{repo.path}</code>
          <CopyButton text={cdCommand(repo.path)} label="Copy cd" />
        </div>
      </div>
      {(canGit || repo.ok) && (
        <div class="band-actions">
          {canGit && <PullButton repoId={repo.id} />}
          {canGit && <CleanupButton repoId={repo.id} repoName={repo.name} onDone={onCreated} />}
          {repo.ok && (
            <button type="button" class="btn primary" onClick={() => setCreating(true)}>
              <IconPlus size={15} />
              New change
            </button>
          )}
        </div>
      )}
      {notice && (
        <div class="notice warn band-note" role="note">
          ⎇ {notice.long}
        </div>
      )}
      {!repo.ok && <div class="notice danger band-note">Scan failed: {repo.error} — showing the last good data.</div>}
      {repo.warnings?.map((w) => (
        <div key={w} class="notice warn band-note">
          {w}
        </div>
      ))}
      {creating && <NewChangeDialog target={{ repoId: repo.id, repoName: repo.name }} onClose={() => setCreating(false)} onCreated={() => { setCreating(false); onCreated(); }} />}
    </div>
  );
}

function RepoNotFound() {
  return (
    <div class="empty">
      <h1>Repository not found</h1>
      <p>It is not tracked (any more). Enable it in Settings, or pick another one.</p>
      <a
        class="btn primary"
        href={href("/")}
        onClick={(e) => {
          e.preventDefault();
          navigate("/");
        }}
      >
        Back to Projects
      </a>
    </div>
  );
}

/** Initial filters of a board: from `query`, read once at mount. A repository board has no repo filter, so a stray `repos` key is dropped. */
export function initialFilters(query: string, repoId: string | undefined): Filters {
  return { ...parseFilters(query), ...(repoId === undefined ? {} : { repos: [] }) };
}

/**
 * The combined board, or one repository's board when `repoId` is set. Its filters come from `query` when given — the
 * board behind an open detail view, where the URL holds the detail view's query — and from the URL otherwise.
 */
export function Kanban({ snapshot, config, repoId, query, onReload }: { snapshot: Snapshot | null; config: Config | null; repoId?: string; query?: string; onReload?: () => void }) {
  const [filters, setFiltersState] = useState<Filters>(() => initialFilters(query ?? currentQuery(), repoId));
  const layout = resolveLayout(filters.layout, useNarrowWindow());
  const now = Date.now();

  const setFilters = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFiltersState(next);
    replaceQuery(serializeFilters(next));
  };

  // Which repository groups are minimized; remembered in the browser, deviations from the defaults only.
  const [groupOverrides, setGroupOverrides] = useState<GroupOverrides>(loadGroupState);
  const toggleGroupState = (groupRepoId: string, column: string) => {
    const next = toggleGroup(groupOverrides, groupRepoId, column);
    setGroupOverrides(next);
    // Prune against every tracked repository (not just the visible ones); without a snapshot nothing is known, so keep all.
    saveGroupState(next, snapshot ? snapshot.repos.map((r) => r.id) : Object.keys(next).map((key) => key.slice(0, key.indexOf("|"))));
  };
  const groupControls: GroupControls = { overrides: groupOverrides, onToggle: toggleGroupState, forceExpanded: filters.q.trim() !== "" };

  const single = repoId !== undefined;
  // Cards carry this board and its filters, so the detail view can lead back here.
  const from = boardFrom(repoId === undefined ? "/board" : repoPath(repoId), serializeFilters(filters));
  const repos: RepoSnapshot[] = useMemo(() => (snapshot?.repos ?? []).filter((r) => !single || r.id === repoId), [snapshot, single, repoId]);
  // Hues come from every repository in the snapshot — not the filtered ones, nor just this board's — so a colour never depends on the view.
  const hues = useMemo(() => assignRepoHues((snapshot?.repos ?? []).map((r) => r.id)), [snapshot]);
  const cards: Card[] = useMemo(
    () => repos.flatMap((r) => r.changes.map((c) => ({ ...c, repoName: r.name, repoPath: r.path, hue: hues.get(r.id) ?? 0 }))),
    [repos, hues],
  );

  const visible = useMemo(() => {
    const q = filters.q.trim().toLowerCase();
    return cards.filter((c) => {
      if (!single && filters.repos.length && !filters.repos.includes(c.repoId)) return false;
      if (q && !c.name.toLowerCase().includes(q) && !c.repoName.toLowerCase().includes(q)) return false;
      if (filters.staleDays > 0) {
        const age = daysSince(c.lastActivityAt, now);
        if (age === undefined || age < filters.staleDays) return false;
      }
      return true;
    });
  }, [cards, filters, now]);

  // A single-repository board follows that repository's own schemas, not the majority across all repos.
  const columns = useMemo(() => (snapshot ? boardColumns({ ...snapshot, repos }) : []), [snapshot, repos]);

  // The combined board's "New change": the project list follows every snapshot, the pre-selection is taken when it opens.
  const targets = useMemo(() => newChangeTargets(single ? [] : repos, filters.repos), [single, repos, filters.repos]);
  const [creating, setCreating] = useState<{ preselected?: string } | null>(null);

  const stats = { open: visible.filter((c) => !c.archived).length, toArchive: cards.filter((c) => isComplete(c.stage)).length };
  // What the columns on screen hold: archived cards only while their column is shown, and at most its bound.
  const archivedVisible = visible.filter((c) => c.column === "Archived").length;
  const showing = visible.length - archivedVisible + (filters.hideArchived ? 0 : Math.min(archivedVisible, ARCHIVED_LIMIT));

  if (snapshot && snapshot.repos.length === 0) return <NoRepos config={config} />;
  if (snapshot && single && repos.length === 0) return <RepoNotFound />;

  return (
    <>
      {single && repos[0] && <RepoHeader repo={repos[0]} now={now} stats={stats} onCreated={() => onReload?.()} />}
      {!single && (
        <div class="band">
          <div class="band-main">
            <div class="row band-title">
              <h1>
                All changes
                <span class="band-sub">
                  {repos.length} {repos.length === 1 ? "repository" : "repositories"} · openspec/changes
                </span>
              </h1>
              <span class="divider" aria-hidden="true" />
              <BoardStats open={stats.open} toArchive={stats.toArchive} />
            </div>
          </div>
          {targets.projects.length > 0 && (
            <div class="band-actions">
              <button type="button" class="btn primary" onClick={() => setCreating({ preselected: targets.preselected })}>
                <IconPlus size={15} />
                New change
              </button>
            </div>
          )}
        </div>
      )}
      <FilterBar filters={filters} setFilters={setFilters} repos={repos} hues={hues} single={single} showing={showing} layout={layout} />
      {!single && creating && (
        <NewChangeDialog
          target={{ projects: targets.projects, preselected: creating.preselected }}
          onClose={() => setCreating(null)}
          onCreated={() => {
            setCreating(null);
            onReload?.();
          }}
        />
      )}
      <div class={`board ${layout === "stack" ? "stacked" : ""}`}>
        {columns.map((label) => {
          const inColumn = visible.filter((c) => c.column === label);
          if (label !== "Archived") {
            return <Column key={label} label={label} cards={inColumn} now={now} hot={label === "Done"} showRepo={!single} from={from} groups={groupControls} />;
          }
          if (filters.hideArchived) return null;
          // A regular column, but bounded to the most recent archives; the header still reports the total.
          const recent = recentArchived(inColumn, ARCHIVED_LIMIT);
          const countLabel = recent.length < inColumn.length ? `${recent.length} of ${inColumn.length}` : undefined;
          return <Column key={label} label={label} cards={recent} now={now} showRepo={!single} from={from} countLabel={countLabel} groups={groupControls} />;
        })}
      </div>
    </>
  );
}
