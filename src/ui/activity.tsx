import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { ActivityEvent, Snapshot } from "../shared/types.ts";
import { describe, EMPTY_ACTIVITY_FILTERS, GROUP_LABELS, GROUP_ORDER, groupByDay, kindsFor, parseActivityFilters, serializeActivityFilters, timeOfDay, tone, type ActivityFilters } from "./activityState.ts";
import { api } from "./api.ts";
import { assignRepoHues } from "./repoGroups.ts";
import { repoPath } from "./routes.ts";
import { currentQuery, href, navigate, replaceQuery } from "./url.ts";

const PAGE = 100;

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
  // How many entries the user has asked for so far, so a refresh keeps what "Load older" brought in.
  const wanted = useRef(PAGE);

  const setFilters = (patch: Partial<ActivityFilters>) => {
    const next = { ...filters, ...patch };
    wanted.current = PAGE;
    setFiltersState(next);
    replaceQuery(serializeActivityFilters(next));
  };

  const query = useMemo(() => ({ repos: filters.repos, kinds: kindsFor(filters.groups) }), [filters]);

  const load = useCallback(async () => {
    try {
      const page = await api.activity({ ...query, limit: Math.min(500, wanted.current) });
      setEvents(page.events);
      setNextBefore(page.nextBefore);
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
      <div class="filters">
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the filter row does not want */}
        <div class="group" role="group" aria-label="Filter by repository">
          <span style={{ color: "var(--fg-subtle)", fontSize: "12px" }}>Repos</span>
          {repos.map((r) => {
            const on = filters.repos.includes(r.id);
            return (
              <button
                type="button"
                key={r.id}
                class={`chip repo-tint ${on ? "on" : ""}`}
                style={repoHue(hues.get(r.id) ?? 0)}
                aria-pressed={on}
                onClick={() => setFilters({ repos: on ? filters.repos.filter((id) => id !== r.id) : [...filters.repos, r.id] })}
              >
                <span class="swatch" />
                {r.name}
              </button>
            );
          })}
        </div>
        {/* biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the filter row does not want */}
        <div class="group" role="group" aria-label="Filter by kind of event">
          <span style={{ color: "var(--fg-subtle)", fontSize: "12px" }}>Show</span>
          {GROUP_ORDER.map((g) => {
            const on = filters.groups.includes(g);
            return (
              <button type="button" key={g} class={`chip ${on ? "on" : ""}`} aria-pressed={on} onClick={() => setFilters({ groups: on ? filters.groups.filter((x) => x !== g) : [...filters.groups, g] })}>
                {GROUP_LABELS[g]}
              </button>
            );
          })}
        </div>
        {filtered && (
          <button type="button" class="btn sm ghost" onClick={() => setFilters(EMPTY_ACTIVITY_FILTERS)}>
            reset
          </button>
        )}
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
                : "Activity appears here as the dashboard observes changes: a change created or moving to another column, tasks being ticked, archives, and agent sessions."}
            </p>
          </div>
        )}
        {days.map((day) => (
          <section key={day.key} class="activity-day" aria-label={day.label}>
            <h2>{day.label}</h2>
            <ol>
              {day.events.map((event) => (
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
          </section>
        ))}
        {nextBefore && (
          <button type="button" class="btn" onClick={loadOlder} disabled={loadingOlder}>
            {loadingOlder ? "Loading…" : "Load older"}
          </button>
        )}
      </div>
    </>
  );
}
