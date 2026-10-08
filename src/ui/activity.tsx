import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import { RETENTION_DAYS } from "../shared/activity.ts";
import type { ActivityEvent, ActivityMetrics, ActivitySummary, Snapshot } from "../shared/types.ts";
import { barShare, browserTimeZone, collapseDay, dayKey, dayLabel, dayTitle, describe, EMPTY_ACTIVITY_FILTERS, GROUP_LABELS, GROUP_ORDER, groupByDay, isBusyDay, kindsFor, loadMetricsHidden, parseActivityFilters, REPOS_SHOWN, saveMetricsHidden, serializeActivityFilters, timeOfDay, tone, visibleFigures, visibleRepos, type ActivityFilters } from "./activityState.ts";
import { api } from "./api.ts";
import { assignRepoHues } from "./repoGroups.ts";
import { FilterTagList, RepoMenu } from "./boardFilters.tsx";
import { IconRotateCcw } from "./icons.tsx";
import { repoPath } from "./routes.ts";
import { currentQuery, href, navigate, replaceQuery } from "./url.ts";

const PAGE = 100;
/** Older entries are not missing by accident: the log drops them (activity-log-retention). */
const KEPT_FOR = `Activity is kept for ${RETENTION_DAYS} days.`;

/** Sets --repo-hue for the `repo-tint` class. */
const repoHue = (hue: number) => ({ "--repo-hue": String(hue) });

/**
 * What the dashboard observed, newest first. History only: it is read from the activity log and never feeds back
 * into the board. `onSeen` tells the app which event is the newest the user has now looked at.
 */
export function Activity({ snapshot, onSeen }: { snapshot: Snapshot | null; onSeen: (newestId: string | undefined) => void }) {
  const [filters, setFiltersState] = useState<ActivityFilters>(() => parseActivityFilters(currentQuery()));
  const [events, setEvents] = useState<ActivityEvent[]>();
  const [nextBefore, setNextBefore] = useState<string>();
  const [error, setError] = useState<string>();
  const [loadingOlder, setLoadingOlder] = useState(false);
  // From the first page only: older pages do not repeat it, and it covers far more than what is loaded.
  const [summary, setSummary] = useState<ActivitySummary>();
  const [metrics, setMetrics] = useState<ActivityMetrics>();
  const [metricsHidden, setMetricsHidden] = useState(loadMetricsHidden);
  // Show N more in the per-project panel; reset with the filters like the busy days.
  const [reposExpanded, setReposExpanded] = useState(false);
  // Busy days the user expanded, by day key; kept across reloads and Load older, reset with the filters.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
  // How many entries the user has asked for so far, so a refresh keeps what "Load older" brought in.
  const wanted = useRef(PAGE);

  const setFilters = (patch: Partial<ActivityFilters>) => {
    const next = { ...filters, ...patch };
    wanted.current = PAGE;
    setExpanded(new Set());
    setReposExpanded(false);
    setFiltersState(next);
    replaceQuery(serializeActivityFilters(next));
  };

  // The per-day metrics are counted in the browser's days, so they match the day headings below.
  const query = useMemo(() => ({ repos: filters.repos, kinds: kindsFor(filters.groups), tz: browserTimeZone() }), [filters]);

  const load = useCallback(async () => {
    try {
      const page = await api.activity({ ...query, limit: Math.min(500, wanted.current) });
      setEvents(page.events);
      setNextBefore(page.nextBefore);
      setSummary(page.summary);
      setMetrics(page.metrics);
      setError(undefined);
      onSeen(page.newestId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [query, onSeen]);

  // Reload with the filters, and whenever a scan produced a new snapshot (that is when new activity can exist).
  // biome-ignore lint/correctness/useExhaustiveDependencies: generatedAt is the refresh signal, not an input
  useEffect(() => {
    void load();
  }, [load, snapshot?.generatedAt]);

  const loadOlder = async () => {
    if (!nextBefore || !events) return;
    setLoadingOlder(true);
    try {
      const page = await api.activity({ ...query, limit: PAGE, before: nextBefore });
      wanted.current += page.events.length;
      setEvents([...events, ...page.events]);
      setNextBefore(page.nextBefore);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingOlder(false);
    }
  };

  const repos = snapshot?.repos ?? [];
  // Same colours as everywhere else: derived from every repository in the snapshot, never from the filtered ones.
  const hues = useMemo(() => assignRepoHues(repos.map((r) => r.id)), [repos]);
  const tracked = useMemo(() => new Set(repos.map((r) => r.id)), [repos]);
  const days = useMemo(() => groupByDay(events ?? [], new Date()), [events]);
  const filtered = filters.repos.length > 0 || filters.groups.length > 0;

  return (
    <>
      <div class="filterbar">
        <div class="filterbar-row">
          <RepoMenu repos={repos} hues={hues} selected={filters.repos} onChange={(ids) => setFilters({ repos: ids })} />
          {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want */}
          <div class="segmented" role="group" aria-label="Filter by kind of event">
            {GROUP_ORDER.map((g) => {
              const on = filters.groups.includes(g);
              return (
                <button type="button" key={g} class={on ? "on" : ""} aria-pressed={on} onClick={() => setFilters({ groups: on ? filters.groups.filter((x) => x !== g) : [...filters.groups, g] })}>
                  {GROUP_LABELS[g]}
                </button>
              );
            })}
          </div>
          {filtered && (
            <button type="button" class="btn sm ghost clear-filters" onClick={() => setFilters(EMPTY_ACTIVITY_FILTERS)}>
              <IconRotateCcw size={12} />
              Clear filters
            </button>
          )}
        </div>
        <FilterTagList
          tags={repos.filter((r) => filters.repos.includes(r.id)).map((r) => ({ key: r.id, label: r.name, repoId: r.id }))}
          hues={hues}
          onRemove={(tag) => setFilters({ repos: filters.repos.filter((id) => id !== tag.repoId) })}
        />
      </div>
      <div class="activity">
        {error && <div class="notice danger">{error}</div>}
        {events === undefined && !error && <div class="hint">Loading…</div>}
        {events?.length === 0 && (
          <div class="activity-empty">
            <h2>{filtered ? "Nothing matches these filters" : "No activity yet"}</h2>
            <p class="hint">
              {filtered
                ? "Try another repository or kind of event."
                : `Activity appears here as the dashboard observes changes: a change created or moving to another column, tasks being ticked, archives, and agent sessions. ${KEPT_FOR}`}
            </p>
          </div>
        )}
        {!!events?.length && summary && (
          <SummaryStrip
            summary={summary}
            filters={filters}
            metricsHidden={metrics ? metricsHidden : undefined}
            onToggleMetrics={() => {
              saveMetricsHidden(!metricsHidden);
              setMetricsHidden(!metricsHidden);
            }}
          />
        )}
        {!!events?.length && metrics && !metricsHidden && (
          <Metrics
            metrics={metrics}
            perProject={filters.repos.length !== 1}
            hues={hues}
            tracked={tracked}
            expanded={reposExpanded}
            onExpand={setReposExpanded}
            onRepo={(id) => setFilters({ repos: [id] })}
          />
        )}
        {days.map((day) => {
          const open = expanded.has(day.key);
          const { shown, hidden } = collapseDay(day, open);
          const toggle = () => {
            const next = new Set(expanded);
            if (open) next.delete(day.key);
            else next.add(day.key);
            setExpanded(next);
          };
          return (
            <section key={day.key} class="activity-day" aria-label={day.label}>
              <h2>{day.label}</h2>
              <ol>
                {shown.map((event) => (
                  // A repository that is no longer tracked has no colour of its own any more: its entries stay neutral.
                  <li key={event.id} class={`activity-entry ${tracked.has(event.repoId) ? "repo-tint" : "untracked"} tone-${tone(event)}`} style={tracked.has(event.repoId) ? repoHue(hues.get(event.repoId) ?? 0) : undefined}>
                    <time dateTime={event.at} title={new Date(event.at).toLocaleString()}>
                      {timeOfDay(event.at)}
                    </time>
                    <span class="repo">
                      <span class="swatch" />
                      {event.repoName}
                    </span>
                    <span class="what">
                      {"change" in event &&
                        (tracked.has(event.repoId) ? (
                          <a
                            class="change"
                            href={href(repoPath(event.repoId))}
                            onClick={(e) => {
                              e.preventDefault();
                              navigate(repoPath(event.repoId));
                            }}
                          >
                            {event.change}
                          </a>
                        ) : (
                          <span class="change">{event.change}</span>
                        ))}
                      <span class="words">{describe(event)}</span>
                      {event.catchUp && (
                        <span class="badge" title={`Noticed ${new Date(event.detectedAt).toLocaleString()}, on the first scan after the dashboard had not been running`}>
                          while the dashboard was not running
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ol>
              {isBusyDay(day) && (
                <button type="button" class="btn sm ghost activity-more" aria-expanded={open} onClick={toggle}>
                  {open ? "Show fewer" : `Show ${hidden} more`}
                </button>
              )}
            </section>
          );
        })}
        {nextBefore && (
          <button type="button" class="btn" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading…" : "Load older"}
          </button>
        )}
        {!nextBefore && !!events?.length && <p class="hint activity-end">{KEPT_FOR}</p>}
      </div>
    </>
  );
}

/** What the retained log holds, over everything matching the filters — not just the loaded page. Describes the feed only. */
function SummaryStrip({ summary, filters, metricsHidden, onToggleMetrics }: { summary: ActivitySummary; filters: ActivityFilters; metricsHidden?: boolean; onToggleMetrics: () => void }) {
  return (
    <section class="activity-summary" aria-label={`Last ${RETENTION_DAYS} days`}>
      <span class="activity-summary-span">Last {RETENTION_DAYS} days</span>
      {visibleFigures(filters.groups).map((f) => (
        <div key={f.key} class={`activity-figure${f.key === "attention" && summary[f.key] > 0 ? " danger" : ""}`}>
          <strong>{summary[f.key]}</strong>
          <span>{f.label}</span>
        </div>
      ))}
      {metricsHidden !== undefined && (
        <button type="button" class="btn sm ghost activity-metrics-toggle" aria-expanded={!metricsHidden} aria-controls="activity-metrics" onClick={onToggleMetrics}>
          {metricsHidden ? "Show details" : "Hide details"}
        </button>
      )}
    </section>
  );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const counts = (c: { events: number; changes: number }) => `${plural(c.events, "event")} · ${plural(c.changes, "change")}`;

/**
 * Where and when the retained log's events happened, per day and per project (add-metrics-to-activity). Like the
 * strip it counts recorded events over everything matching the filters, and describes the feed only.
 */
function Metrics({
  metrics,
  perProject,
  hues,
  tracked,
  expanded,
  onExpand,
  onRepo,
}: {
  metrics: ActivityMetrics;
  perProject: boolean;
  hues: ReadonlyMap<string, number>;
  tracked: ReadonlySet<string>;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  onRepo: (repoId: string) => void;
}) {
  const today = dayKey(new Date());
  const busiestDay = Math.max(0, ...metrics.days.map((d) => d.events));
  const busiestRepo = metrics.repos[0]?.events ?? 0;
  const { shown, hidden } = visibleRepos(metrics.repos, expanded);
  return (
    <section id="activity-metrics" class="activity-metrics" aria-label="Activity per day and per project">
      <div class="activity-panel">
        <h3>
          Per day <span>{counts(metrics)}</span>
        </h3>
        <ol class="activity-day-bars">
          {metrics.days.map((d, i) => {
            const title = `${dayTitle(d.day)}: ${counts(d)}${i === 0 ? " (partly kept)" : ""}`;
            return (
              <li key={d.day} title={title} aria-label={title}>
                <span class="activity-bar-count">{d.events > 0 ? d.events : ""}</span>
                <span class="activity-bar">
                  <span class="activity-bar-fill" style={{ height: `${barShare(d.events, busiestDay) * 100}%` }} />
                </span>
                <span class="activity-bar-label">{dayLabel(d.day, today)}</span>
              </li>
            );
          })}
        </ol>
      </div>
      {perProject && (
        <div class="activity-panel">
          <h3>
            Per project <span>{plural(metrics.repos.length, "project")}</span>
          </h3>
          <ol class="activity-repo-bars">
            {shown.map((r) => {
              const isTracked = tracked.has(r.repoId);
              const body = (
                <>
                  <span class="repo">
                    <span class="swatch" />
                    {r.repoName}
                  </span>
                  <span class="activity-bar">
                    <span class="activity-bar-fill" style={{ width: `${barShare(r.events, busiestRepo) * 100}%` }} />
                  </span>
                  <span class="activity-repo-counts">{counts(r)}</span>
                </>
              );
              return (
                <li key={r.repoId} class={isTracked ? "repo-tint" : "is-untracked"} style={isTracked ? repoHue(hues.get(r.repoId) ?? 0) : undefined}>
                  {isTracked ? (
                    <button type="button" class="activity-repo-row" title={`Show only ${r.repoName}`} onClick={() => onRepo(r.repoId)}>
                      {body}
                    </button>
                  ) : (
                    <div class="activity-repo-row" title="No longer tracked">
                      {body}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
          {metrics.repos.length > REPOS_SHOWN && (
            <button type="button" class="btn sm ghost activity-more" aria-expanded={expanded} onClick={() => onExpand(!expanded)}>
              {expanded ? "Show fewer" : `Show ${hidden} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
