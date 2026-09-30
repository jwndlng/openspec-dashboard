// The Pull requests view, the dialog on a repository board, and the cache both read from.
//
// GitHub is contacted only from here, and only because the user activated Refresh or opened one of these two with a
// stale cache (openspec/specs/pull-requests). The page itself requests nothing but the dashboard's own API: the links
// to github.com are ordinary links the user follows.
import { type ComponentChildren, createContext } from "preact";
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { PullRequest, PullRequestsResponse, Snapshot } from "../shared/types.ts";
import { api } from "./api.ts";
import { Stat } from "./band.tsx";
import { relTime } from "./format.ts";
import { IconChevronDown, IconGitPullRequest, IconRefresh, IconRotateCcw } from "./icons.tsx";
import { Modal } from "./modal.tsx";
import {
  DEFAULT_PR_FILTERS,
  ghSetup,
  isStale,
  newestFetchedAt,
  openCount,
  parsePrFilters,
  type PrEntry,
  type PrFilters,
  type PrGroups,
  type PrRepo,
  prAgeAt,
  pullRequestEntries,
  pullRequestNotices,
  pullRequestsQuery,
  serializePrFilters,
} from "./pullRequestsState.ts";
import { assignRepoHues } from "./repoGroups.ts";
import { PULL_REQUESTS_PATH } from "./routes.ts";
import { currentQuery, hrefWithQuery, navigate, replaceQuery } from "./url.ts";

/** The server's own freshness window; the UI only uses it to decide whether opening a view is worth a refresh. */
const FRESHNESS_MS = 5 * 60_000;

interface PullRequestsUi {
  data?: PullRequestsResponse;
  /** The first read of the cache has not answered yet. */
  loading: boolean;
  /** A refresh is running: for everything, or for one repository. */
  running: string | "all" | undefined;
  error?: string;
  /** Refreshes through the API. `force` skips the freshness window; without it the server decides. */
  refresh(options?: { repoId?: string; force?: boolean }): Promise<void>;
  /** Refreshes only when a shown list is older than the freshness window — what opening a view does. */
  refreshIfStale(repoId?: string): void;
}

const Context = createContext<PullRequestsUi>({ loading: false, running: undefined, refresh: async () => {}, refreshIfStale: () => {} });

export const usePullRequests = () => useContext(Context);

/**
 * Holds the cached lists for every view. Reading them on mount contacts nothing; only `refresh` does, and only from
 * the two places the user can ask for it.
 */
export function PullRequestsProvider({ children }: { children: ComponentChildren }) {
  const [data, setData] = useState<PullRequestsResponse>();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | "all" | undefined>();
  const [error, setError] = useState<string>();
  // The refresh in flight, so a second view opening meanwhile joins it instead of asking again.
  const inFlight = useRef<Promise<void>>();
  const latest = useRef<PullRequestsResponse>();

  useEffect(() => {
    let live = true;
    api
      .pullRequests()
      .then((answer) => {
        if (!live) return;
        latest.current = answer;
        setData(answer);
      })
      .catch((err) => live && setError(err instanceof Error ? err.message : String(err)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, []);

  const refresh = useCallback(async (options: { repoId?: string; force?: boolean } = {}) => {
    if (inFlight.current) return inFlight.current;
    setRunning(options.repoId ?? "all");
    const done = api
      .refreshPullRequests(options)
      .then((answer) => {
        latest.current = answer;
        setData(answer);
        setError(undefined);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => {
        inFlight.current = undefined;
        setRunning(undefined);
      });
    inFlight.current = done;
    return done;
  }, []);

  const refreshIfStale = useCallback(
    (repoId?: string) => {
      const shown = repoId && latest.current ? { repos: latest.current.repos.filter((r) => r.repoId === repoId) } : latest.current;
      if (isStale(shown, FRESHNESS_MS)) void refresh(repoId ? { repoId } : {});
    },
    [refresh],
  );

  return <Context.Provider value={{ data, loading, running, error, refresh, refreshIfStale }}>{children}</Context.Provider>;
}

// ---- chips ----

const STATE_CHIP: Record<PullRequest["state"], { text: string; title: string; tone: string }> = {
  open: { text: "Open", title: "Open on GitHub", tone: "" },
  merged: { text: "Merged", title: "Merged", tone: "success" },
  closed: { text: "Closed", title: "Closed without merging", tone: "quiet" },
};

const REVIEW_CHIP: Record<PullRequest["review"], { text: string; title: string; tone: string } | undefined> = {
  approved: { text: "✓ Approved", title: "Review decision: approved", tone: "success" },
  changes_requested: { text: "Changes requested", title: "Review decision: changes requested", tone: "warning" },
  review_required: { text: "Review required", title: "Review decision: review required", tone: "" },
  none: undefined,
};

const CHECKS_CHIP: Record<PullRequest["checks"], { text: string; title: string; tone: string } | undefined> = {
  passing: { text: "✓ Checks", title: "All checks passed", tone: "success" },
  failing: { text: "✕ Checks", title: "At least one check failed", tone: "danger" },
  pending: { text: "… Checks", title: "Checks are still running", tone: "warning" },
  none: undefined,
};

/** Text plus a symbol plus a tooltip — never colour alone. */
function Chip({ chip }: { chip: { text: string; title: string; tone: string } }) {
  return (
    <span class={`badge pr-chip ${chip.tone}`} title={chip.title}>
      {chip.text}
    </span>
  );
}

// ---- entries ----

const repoHue = (hue: number) => ({ "--repo-hue": String(hue) });

function Entry({ entry, hue, showRepo }: { entry: PrEntry; hue?: number; showRepo: boolean }) {
  const { pr } = entry;
  const age = prAgeAt(pr);
  const verb = pr.state === "open" ? "opened" : pr.state === "merged" ? "merged" : "closed";
  const stateChip = pr.draft && pr.state === "open" ? { text: "Draft", title: "A draft pull request", tone: "quiet" } : STATE_CHIP[pr.state];
  const review = REVIEW_CHIP[pr.review];
  const checks = CHECKS_CHIP[pr.checks];
  return (
    <li class={`pr-entry ${hue === undefined ? "" : "repo-tint"}`} style={hue === undefined ? undefined : repoHue(hue)}>
      <div class="pr-main">
        {showRepo && (
          <span class="repo" title={entry.alsoIn.length ? `also tracked as ${entry.alsoIn.join(", ")}` : (entry.github ?? entry.repoName)}>
            <span class="swatch" />
            {entry.repoName}
          </span>
        )}
        <span class="pr-number mono">#{pr.number}</span>
        {/* A link the user follows; the page itself never requests github.com. */}
        <a class="pr-title" href={pr.url} target="_blank" rel="noopener noreferrer" title={`${pr.title} — open on GitHub`}>
          {pr.title}
        </a>
        {pr.reviewRequestedFromViewer && (
          <span class="badge pr-chip attention" title="Your review is requested on this pull request">
            review requested from you
          </span>
        )}
      </div>
      <div class="pr-meta">
        <Chip chip={stateChip} />
        {review && <Chip chip={review} />}
        {checks && <Chip chip={checks} />}
        <span class="pr-branch mono truncate" title={`${pr.head} → ${pr.base}`}>
          {pr.head}
        </span>
        {pr.author && <span class="pr-author">{pr.author}</span>}
        <span class="pr-age" title={age ? new Date(age).toLocaleString() : undefined}>
          {verb} {relTime(age)}
          {relTime(age) === "just now" ? "" : " ago"}
        </span>
      </div>
    </li>
  );
}

/** The two groups, as the view and the repository dialog both show them. */
export function PullRequestList({ groups, hues, showRepo }: { groups: PrGroups; hues?: Map<string, number>; showRepo: boolean }) {
  const section = (label: string, entries: PrEntry[]) =>
    entries.length === 0 ? null : (
      <section class="pr-group" aria-label={label}>
        <h2>
          {label}
          <span class="count">{entries.length}</span>
        </h2>
        <ol>
          {entries.map((entry) => (
            <Entry key={`${entry.github ?? entry.repoId}#${entry.pr.number}`} entry={entry} hue={hues?.get(entry.repoId)} showRepo={showRepo} />
          ))}
        </ol>
      </section>
    );
  return (
    <>
      {section("Open", groups.open)}
      {section("Recently merged or closed", groups.closed)}
    </>
  );
}

/** What could not be listed, folded away: reasons belong in the view, not in the middle of the list. */
function Notices({ notices }: { notices: { repoId: string; repoName: string; status: string; reason?: string; hasList: boolean }[] }) {
  if (notices.length === 0) return null;
  return (
    <details class="pr-notices">
      <summary>
        {notices.length} {notices.length === 1 ? "repository" : "repositories"} could not be listed
      </summary>
      <ul>
        {notices.map((n) => (
          <li key={n.repoId}>
            <strong>{n.repoName}</strong>
            <span class={`badge ${n.status === "failed" ? "warning" : ""}`}>{n.status === "failed" ? "failed" : "unavailable"}</span>
            <span class="hint">{n.reason ?? "no reason given"}</span>
            {n.hasList && <span class="hint">showing the last list that was fetched</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function GhSetupNotice({ response }: { response: PullRequestsResponse }) {
  const setup = ghSetup(response);
  if (!setup) return null;
  return (
    <div class="notice warn" role="note">
      <strong>{setup.what}</strong> {setup.how} The dashboard uses your own <code>gh</code> sign-in and never sees a token.
    </div>
  );
}

function FetchAge({ response }: { response: PullRequestsResponse | undefined }) {
  const at = response && newestFetchedAt(response);
  if (!at) return <span class="hint">not fetched yet</span>;
  const age = relTime(at);
  return (
    <span class="hint" title={new Date(at).toLocaleString()}>
      fetched {age === "just now" ? age : `${age} ago`}
    </span>
  );
}

export function RefreshButton({ repoId, compact = false }: { repoId?: string; compact?: boolean }) {
  const ui = usePullRequests();
  const running = ui.running !== undefined;
  return (
    <button
      type="button"
      class={`btn sm ${compact ? "ghost" : ""}`}
      disabled={running}
      title="Ask GitHub for these pull requests now, through your own gh sign-in"
      onClick={() => void ui.refresh({ repoId, force: true })}
    >
      <IconRefresh size={13} />
      {running ? "Refreshing…" : "Refresh"}
    </button>
  );
}

// ---- the view ----

const STATE_LABEL: Record<PrFilters["state"], string> = { all: "Open and recently closed", open: "Open only", closed: "Recently merged or closed" };

export function PullRequestsView({ snapshot }: { snapshot: Snapshot | null }) {
  const ui = usePullRequests();
  const [filters, setFiltersState] = useState<PrFilters>(() => parsePrFilters(currentQuery()));

  const setFilters = (patch: Partial<PrFilters>) => {
    const next = { ...filters, ...patch };
    setFiltersState(next);
    replaceQuery(serializePrFilters(next));
  };

  // Opening the view refreshes when the cached lists are stale — the one place besides Refresh that contacts GitHub.
  const { refreshIfStale, loading } = ui;
  useEffect(() => {
    if (!loading) refreshIfStale();
  }, [loading, refreshIfStale]);

  const repos: PrRepo[] = useMemo(() => (snapshot?.repos ?? []).map((r) => ({ id: r.id, name: r.name })), [snapshot]);
  const hues = useMemo(() => assignRepoHues(repos.map((r) => r.id)), [repos]);
  const data = ui.data;
  const groups = useMemo(() => (data ? pullRequestEntries(data, repos, filters) : { open: [], closed: [] }), [data, repos, filters]);
  const notices = useMemo(() => (data ? pullRequestNotices(data, repos, filters) : []), [data, repos, filters]);
  const total = groups.open.length + groups.closed.length;
  const filtered = filters.repo !== undefined || filters.state !== "all" || filters.mine;
  const awaitingMe = groups.open.filter((e) => e.pr.reviewRequestedFromViewer).length;

  return (
    <>
      <div class="band">
        <div class="band-main">
          <div class="row band-title">
            <h1>
              Pull requests
              <span class="band-sub">open and recently closed, across all tracked repositories</span>
            </h1>
            <span class="divider" aria-hidden="true" />
            <span class="stats">
              <Stat label="Open" value={groups.open.length} />
              <Stat label="Awaiting your review" value={awaitingMe} tone={awaitingMe > 0 ? "success" : undefined} />
            </span>
          </div>
        </div>
        <div class="band-actions">
          <FetchAge response={data} />
          <RefreshButton />
        </div>
      </div>
      <div class="filterbar">
        <div class="filterbar-row">
          <label class="control select-control" for="pr-repo">
            <span>Repository</span>
            <select id="pr-repo" value={filters.repo ?? ""} onChange={(e) => setFilters({ repo: e.currentTarget.value || undefined })}>
              <option value="">All repositories</option>
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <IconChevronDown size={12} />
          </label>
          <label class="control select-control" for="pr-state">
            <span>Show</span>
            <select id="pr-state" value={filters.state} onChange={(e) => setFilters({ state: e.currentTarget.value as PrFilters["state"] })}>
              {(["all", "open", "closed"] as PrFilters["state"][]).map((s) => (
                <option key={s} value={s}>
                  {STATE_LABEL[s]}
                </option>
              ))}
            </select>
            <IconChevronDown size={12} />
          </label>
          <button
            type="button"
            class={`control switch-control ${filters.mine ? "on" : ""}`}
            aria-pressed={filters.mine}
            title="Only open pull requests whose review is requested from the signed-in GitHub user"
            onClick={() => setFilters({ mine: !filters.mine })}
          >
            <span class="switch" aria-hidden="true" />
            Review requested from me
          </button>
          {filtered && (
            <button type="button" class="btn sm ghost clear-filters" onClick={() => setFilters(DEFAULT_PR_FILTERS)}>
              <IconRotateCcw size={12} />
              Clear filters
            </button>
          )}
          <span class="spacer" />
          {data?.viewer && <span class="hint">signed in as {data.viewer}</span>}
        </div>
      </div>
      <div class="pull-requests">
        {ui.error && <div class="notice danger">{ui.error}</div>}
        {data && <GhSetupNotice response={data} />}
        <Notices notices={notices} />
        {ui.loading && <div class="hint">Loading…</div>}
        {!ui.loading && total === 0 && (
          <div class="empty pr-empty">
            <h2>{filtered ? "Nothing matches these filters" : "No recent pull requests"}</h2>
            <p class="hint">
              {filtered ? "Try another repository, state, or turn the review filter off." : "Open pull requests and those merged or closed in the last 7 days appear here."}{" "}
              <FetchAge response={data} />
            </p>
          </div>
        )}
        <PullRequestList groups={groups} hues={hues} showRepo={filters.repo === undefined} />
      </div>
    </>
  );
}

// ---- the repository board's control ----

/**
 * The board header's pull requests control and its dialog. Opening it refreshes the repository's list when that list
 * is stale; the board itself never contacts GitHub.
 */
export function RepoPullRequestsButton({ repoId, repoName }: { repoId: string; repoName: string }) {
  const ui = usePullRequests();
  const [open, setOpen] = useState(false);
  const count = openCount(ui.data, repoId);
  const list = ui.data?.repos.find((r) => r.repoId === repoId);
  const groups = useMemo(
    () => (ui.data ? pullRequestEntries(ui.data, [{ id: repoId, name: repoName }], { ...DEFAULT_PR_FILTERS, repo: repoId }) : { open: [], closed: [] }),
    [ui.data, repoId, repoName],
  );
  const query = pullRequestsQuery(repoId);

  const label = count.open === undefined ? "Pull requests" : `${count.open} open ${count.open === 1 ? "PR" : "PRs"}`;
  return (
    <>
      <button
        type="button"
        class={`control pr-button ${count.awaitingMe ? "attention" : ""}`}
        aria-haspopup="dialog"
        title={count.open === undefined ? (count.reason ?? "pull requests have not been fetched yet") : "This repository's pull requests on GitHub"}
        onClick={() => {
          setOpen(true);
          ui.refreshIfStale(repoId);
        }}
      >
        <IconGitPullRequest size={13} />
        {label}
        {count.awaitingMe > 0 && <span class="control-value">{count.awaitingMe} for you</span>}
      </button>
      {open && (
        <Modal
          label={`Pull requests of ${repoName}`}
          title={`Pull requests of ${repoName}`}
          subtitle={
            <>
              <FetchAge response={ui.data} />
              {list?.github ? ` · ${list.github}` : ""}
            </>
          }
          icon={<IconGitPullRequest size={18} />}
          onClose={() => setOpen(false)}
          wide
        >
          <div class="pr-dialog">
            <div class="pr-dialog-actions">
              <RefreshButton repoId={repoId} />
              <a
                class="btn sm ghost"
                href={hrefWithQuery(PULL_REQUESTS_PATH, query)}
                onClick={(e) => {
                  e.preventDefault();
                  setOpen(false);
                  navigate(PULL_REQUESTS_PATH, query);
                }}
              >
                Open in Pull requests
              </a>
            </div>
            {ui.error && <div class="notice danger">{ui.error}</div>}
            {ui.data && <GhSetupNotice response={ui.data} />}
            {list && (list.status === "unavailable" || list.status === "failed") && !list.setup && (
              <div class={`notice ${list.status === "failed" ? "warn" : ""}`} role="note">
                {list.reason ?? "this repository's pull requests are unavailable"}
              </div>
            )}
            {groups.open.length + groups.closed.length === 0 ? <p class="hint">No open or recently closed pull requests.</p> : <PullRequestList groups={groups} showRepo={false} />}
          </div>
        </Modal>
      )}
    </>
  );
}

/** The overview's figure: cached only, and a link into the filtered view. */
export function OpenPrCount({ repoId, compact = false }: { repoId: string; compact?: boolean }) {
  const ui = usePullRequests();
  const count = openCount(ui.data, repoId);
  const query = pullRequestsQuery(repoId);
  if (count.open === undefined) {
    return (
      <span class="zero" title={count.reason ?? "pull requests have not been fetched yet"}>
        ·
      </span>
    );
  }
  const parts = [`${count.open} open pull request${count.open === 1 ? "" : "s"}`];
  if (count.awaitingMe > 0) parts.push(`${count.awaitingMe} awaiting your review`);
  parts.push(count.fetchedAt ? `fetched ${relTime(count.fetchedAt)} ago`.replace("just now ago", "just now") : "never fetched");
  if (count.reason) parts.push(count.reason);
  return (
    <a
      class={`pr-count ${count.awaitingMe ? "attention" : ""} ${compact ? "compact" : ""}`}
      href={hrefWithQuery(PULL_REQUESTS_PATH, query)}
      title={parts.join(" · ")}
      onClick={(e) => {
        // The overview's rows and tiles open the board on a click; this link goes to the Pull requests view instead.
        e.stopPropagation();
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        navigate(PULL_REQUESTS_PATH, query);
      }}
    >
      {count.open}
      {count.awaitingMe > 0 && <span class="for-you">{count.awaitingMe}</span>}
    </a>
  );
}
