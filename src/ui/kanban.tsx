import { useEffect, useMemo, useState } from "preact/hooks";
import { boardColumns, isComplete } from "../shared/columns.ts";
import type { ChangeSnapshot, Config, RepoSnapshot, Snapshot } from "../shared/types.ts";
import { NoRepos } from "./empty.tsx";
import { EMPTY_FILTERS, parseFilters, serializeFilters, type Filters } from "./filters.ts";
import { PullButton } from "./pull.tsx";
import { branchNotice } from "./pullState.ts";
import { applyCommand, cdCommand, checkoutHint, daysSince, pendingArchiveHint, relTime, splitBranchLabel } from "./format.ts";
import { isMinimized, loadGroupState, saveGroupState, toggleGroup, type GroupOverrides } from "./groupState.ts";
import { assignRepoHues, groupByRepo, recentArchived } from "./repoGroups.ts";
import { SessionControls } from "./sessions.tsx";
import { boardFrom, changePath, repoPath, serializeDetailQuery } from "./routes.ts";
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

export function CopyButton({ text, label = "Copy apply" }: { text: string; label?: string }) {
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

/**
 * Branch name that never outgrows its container: the head is clipped with an ellipsis, the tail always
 * shows. All characters stay in the DOM (copyable); the full name is the tooltip and accessible name.
 */
export function BranchBadge({ branch, hint }: { branch: string; hint: string }) {
  const { head, tail } = splitBranchLabel(branch);
  return (
    <span class="badge brand mono truncate" title={`${branch} — ${hint}`} role="img" aria-label={`branch ${branch}`}>
      <span aria-hidden="true">⎇</span>
      <span class="text" aria-hidden="true">
        <span class="head">{head}</span>
        {tail && <span class="tail">{tail}</span>}
      </span>
    </span>
  );
}

export function Meter({ done, total }: { done: number; total: number }) {
  const full = total > 0 && done === total;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div class={`meter ${full ? "full" : ""}`} title={`${pct}% of tasks complete`}>
      <div class="track">
        <div class="fill" style={{ width: `${pct}%` }} />
      </div>
      <span class="value">
        {done}/{total}
      </span>
    </div>
  );
}

/** Where a card leads: its change's detail view, remembering the board (`from`) it sits on. */
export function cardLink(card: Pick<Card, "repoId" | "name">, from: string): { path: string; query: string } {
  return { path: changePath(card.repoId, card.name), query: serializeDetailQuery({ raw: false, from }) };
}

/**
 * The change name is the card's link, stretched over the whole card in CSS. The copy button and the session
 * starters are siblings of the anchor, not descendants, so activating them can never navigate.
 */
export function ChangeCard({ card, now, showRepo, from }: { card: Card; now: number; showRepo: boolean; from: string }) {
  const age = daysSince(card.lastActivityAt, now);
  const noTasks = card.warnings?.includes("tasks file has no tasks");
  const link = cardLink(card, from);
  const name = (
    <a class="card-link" href={href(link.path, undefined, link.query)} onClick={(e) => followInApp(e, link.path, link.query)}>
      {card.name}
    </a>
  );
  const pending = pendingArchiveHint(card);
  return (
    <article class="card repo-tint" style={repoHue(card.hue)}>
      {/* On a single-repository board the header already names the repo, so the change name takes the top row. */}
      <div class="repo">
        {showRepo ? <span>{card.repoName}</span> : <span class="name">{name}</span>}
        {/* Apply where the change lives: for a change in a worktree that is the worktree, never the main checkout. */}
        {!card.archived && <CopyButton text={applyCommand(card.checkout?.path ?? card.repoPath, card.name)} />}
      </div>
      {showRepo && <div class="name">{name}</div>}
      {card.tasks && card.tasks.total > 0 && <Meter done={card.tasks.done} total={card.tasks.total} />}
      <div class="meta">
        <span class="badge" title={card.lastActivityAt ? `last activity ${card.lastActivityAt}` : "no activity date"}>
          {card.archived ? `archived ${card.archived}` : `${relTime(card.lastActivityAt, now)} ago`}
        </span>
        {isComplete(card.stage) && age !== undefined && <span class="badge ok">✓ complete · {age}d</span>}
        {pending && (
          <span class="badge warn" title={pending.title}>
            ⑂ {pending.label}
          </span>
        )}
        {card.branchMatch && <BranchBadge branch={card.branchMatch} hint={checkoutHint(card)} />}
        {noTasks && <span class="badge warn">no tasks</span>}
        <SessionControls card={card} />
        {card.warnings?.filter((w) => w !== "tasks file has no tasks").map((w) => (
          <span class="badge danger" title={w}>
            ⚠ error
          </span>
        ))}
      </div>
    </article>
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
          <ChangeCard key={`${c.repoId}/${c.name}`} card={c} now={now} showRepo={false} from={from} />
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
                  <ChangeCard key={`${c.repoId}/${c.name}`} card={c} now={now} showRepo from={from} />
                ))}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

/** What the lifecycle columns mean; artifact columns are self-explanatory ("this artifact is written"). */
const COLUMN_HINT: Record<string, string> = {
  New: "Created, nothing written yet",
  Ready: "Every artifact is written; no task ticked yet",
  Implementing: "At least one task ticked",
  Done: "All tasks complete; delta specs not yet synced into openspec/specs",
  Synced: "All tasks complete and specs synced (or nothing to sync); ready to archive",
  Archived: `Archived changes; the ${ARCHIVED_LIMIT} most recent are shown`,
};

// `countLabel` replaces the card count in the header when the column shows only part of its cards (Archived).
function Column({ label, cards, now, hot, showRepo, from, countLabel, groups }: { label: string; cards: Card[]; now: number; hot?: boolean; showRepo: boolean; from: string; countLabel?: string; groups: GroupControls }) {
  return (
    <section class="column">
      <div class="column-head">
        <h2 title={COLUMN_HINT[label]}>{label}</h2>
        <span class={`count ${hot && cards.length ? "hot" : ""}`}>{countLabel ?? cards.length}</span>
      </div>
      <RepoGroups column={label} cards={cards} now={now} showRepo={showRepo} from={from} groups={groups} />
    </section>
  );
}

function RepoHeader({ repo, now }: { repo: RepoSnapshot; now: number }) {
  const updated = repo.lastUpdatedAt ? relTime(repo.lastUpdatedAt, now) : undefined;
  const notice = branchNotice(repo);
  return (
    <div class="repo-head">
      <div class="row">
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
        {repo.currentBranch && <BranchBadge branch={repo.currentBranch} hint="current branch" />}
        {repo.isGit && repo.ok && <PullButton repoId={repo.id} />}
        {repo.worktrees.length > 0 && (
          <span class="badge" title={repo.worktrees.map((w) => `${w.branch ?? "detached"} — ${w.path}`).join("\n")}>
            {repo.worktrees.length} {repo.worktrees.length === 1 ? "worktree" : "worktrees"}
          </span>
        )}
        {repo.sharedConfig?.unreadable && (
          <span class="badge danger" title="openspec/config.yaml is missing, not valid YAML, or has malformed shared-config markers">
            ⚙ config unreadable
          </span>
        )}
        {repo.sharedConfig?.applied.map((p) => (
          <span key={p.id} class={`badge ${p.state === "in-sync" ? "" : "warn"}`} title="Shared OpenSpec config profile carried by openspec/config.yaml">
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
      {notice && (
        <div class="notice warn" role="note">
          ⎇ {notice.long}
        </div>
      )}
      {!repo.ok && <div class="notice danger">Scan failed: {repo.error} — showing the last good data.</div>}
      {repo.warnings?.map((w) => (
        <div key={w} class="notice warn">
          {w}
        </div>
      ))}
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

/** The combined board, or one repository's board when `repoId` is set. */
export function Kanban({ snapshot, config, repoId }: { snapshot: Snapshot | null; config: Config | null; repoId?: string }) {
  // A repository board has no repo filter, so a stray `repos` key in the URL is dropped.
  const [filters, setFiltersState] = useState<Filters>(() => ({ ...parseFilters(currentQuery()), ...(repoId === undefined ? {} : { repos: [] }) }));
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

  if (snapshot && snapshot.repos.length === 0) return <NoRepos config={config} />;
  if (snapshot && single && repos.length === 0) return <RepoNotFound />;

  return (
    <>
      {single && repos[0] && <RepoHeader repo={repos[0]} now={now} />}
      <div class="filters">
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the filter row does not want */}
        <div class="group" role="group" aria-label="Filter by repository" hidden={single}>
          <span style={{ color: "var(--fg-subtle)", fontSize: "12px" }}>Repos</span>
          {repos.map((r) => {
            const on = filters.repos.includes(r.id);
            return (
              <button type="button"
                class={`chip repo-tint ${on ? "on" : ""} ${r.ok ? "" : "error"}`}
                style={repoHue(hues.get(r.id) ?? 0)}
                title={r.ok ? r.path : r.error}
                onClick={() => setFilters({ repos: on ? filters.repos.filter((id) => id !== r.id) : [...filters.repos, r.id] })}
              >
                <span class="swatch" />
                {r.name}
              </button>
            );
          })}
          {filters.repos.length > 0 && (
            <button type="button" class="btn sm ghost" onClick={() => setFilters({ repos: [] })}>
              clear
            </button>
          )}
        </div>
        <div class="group">
          <input class="input" type="search" placeholder="Search change or repo…" value={filters.q} onInput={(e) => setFilters({ q: e.currentTarget.value })} />
        </div>
        <div class="group">
          <label class="check">
            Stale ≥
            <input class="input num" type="number" min={0} value={filters.staleDays || ""} placeholder="off" onInput={(e) => setFilters({ staleDays: Number(e.currentTarget.value) || 0 })} />
            days
          </label>
        </div>
        <label class="check">
          <input type="checkbox" checked={filters.hideArchived} onChange={(e) => setFilters({ hideArchived: e.currentTarget.checked })} />
          hide archived
        </label>
        {(filters.q || filters.repos.length || filters.staleDays || filters.hideArchived) ? (
          <button type="button" class="btn sm ghost" onClick={() => setFilters(EMPTY_FILTERS)}>
            reset
          </button>
        ) : null}
        <span class="spacer" style={{ flex: 1 }} />
        <span class="badge mono">{visible.filter((c) => !c.archived).length} open · {cards.filter((c) => isComplete(c.stage)).length} to archive</span>
      </div>
      <div class="board">
        {columns.map((label) => {
          const inColumn = visible.filter((c) => c.column === label);
          if (label !== "Archived") {
            return <Column key={label} label={label} cards={inColumn} now={now} hot={label === "Done" || label === "Synced"} showRepo={!single} from={from} groups={groupControls} />;
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
