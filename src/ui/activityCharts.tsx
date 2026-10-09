// The Activity view's figures and charts (refactor-metrics-activity): summary tiles with a per-day trend, events per
// day stacked by kind, a heatmap of the hours, and projects stacked by kind — each with a table twin. Drawn with plain
// HTML and CSS, no library and nothing fetched. Like the feed they describe history only, never the board.
import { useState } from "preact/hooks";
import { RETENTION_DAYS } from "../shared/activity.ts";
import type { ActivityDayCount, ActivityGroupCounts, ActivityMetrics, ActivityRepoCount, ActivitySummary } from "../shared/types.ts";
import { type ActivityGroup, axisTicks, barShare, busiestHour, chartGroups, dayKey, dayLabel, dayTitle, type Figure, GROUP_LABELS, heatStep, hourLabel, type MetricsView, REPOS_SHOWN, visibleRepos } from "./activityState.ts";

/** Sets --repo-hue for the `repo-tint` class. */
const repoHue = (hue: number) => ({ "--repo-hue": String(hue) });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
const counts = (c: { events: number; changes: number }) => `${plural(c.events, "event")} · ${plural(c.changes, "change")}`;
const byGroup = (groups: ActivityGroupCounts, shown: readonly ActivityGroup[]) => shown.map((g) => `${GROUP_LABELS[g]} ${groups[g]}`).join(" · ");

// ---- summary tiles ----

/**
 * The six figures as tiles, each with its value per day as a small trend, today set apart. Counts recorded events
 * over everything matching the filters, like the strip it replaces; `need attention` keeps its label when it turns red.
 */
export function SummaryTiles({
  summary,
  days,
  figures,
  metricsHidden,
  onToggleMetrics,
  view,
  onView,
}: {
  summary: ActivitySummary;
  days: readonly ActivityDayCount[] | undefined;
  figures: readonly Figure[];
  /** Undefined when there are no metrics to hide. */
  metricsHidden?: boolean;
  onToggleMetrics: () => void;
  view: MetricsView;
  onView: (view: MetricsView) => void;
}) {
  const today = dayKey(new Date());
  return (
    <section class="activity-summary" aria-label={`Last ${RETENTION_DAYS} days`}>
      <div class="activity-summary-head">
        <span class="activity-summary-span">Last {RETENTION_DAYS} days</span>
        {metricsHidden === false && (
          // biome-ignore lint/a11y/useSemanticElements: a fieldset would bring legend/border styling the control does not want
          <div class="segmented sm" role="group" aria-label="Show the metrics as">
            {(["chart", "table"] as const).map((v) => (
              <button type="button" key={v} class={view === v ? "on" : ""} aria-pressed={view === v} onClick={() => onView(v)}>
                {v === "chart" ? "Chart" : "Table"}
              </button>
            ))}
          </div>
        )}
        {metricsHidden !== undefined && (
          <button type="button" class="btn sm ghost activity-metrics-toggle" aria-expanded={!metricsHidden} aria-controls="activity-metrics" onClick={onToggleMetrics}>
            {metricsHidden ? "Show details" : "Hide details"}
          </button>
        )}
      </div>
      <ul class="activity-tiles">
        {figures.map((f) => {
          const value = summary[f.key];
          const danger = f.key === "attention" && value > 0;
          return (
            <li key={f.key} class={`activity-tile${danger ? " danger" : ""}`}>
              <span class="activity-tile-label">{f.label}</span>
              <strong class="activity-tile-value">{value}</strong>
              {days && <Trend days={days} pick={(d) => d.figures[f.key]} label={f.label} today={today} />}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** A figure per day, oldest to today, as thin columns against its own busiest day. Every value is in its label. */
function Trend({ days, pick, label, today }: { days: readonly ActivityDayCount[]; pick: (d: ActivityDayCount) => number; label: string; today: string }) {
  const values = days.map(pick);
  const max = Math.max(0, ...values);
  const described = days.map((d, i) => `${dayLabel(d.day, today)} ${values[i]}`).join(", ");
  return (
    <span class="activity-trend" role="img" aria-label={`${label} per day: ${described}`}>
      {days.map((d, i) => (
        <span key={d.day} class={`activity-trend-mark${d.day === today ? " today" : ""}`} title={`${dayTitle(d.day)}: ${values[i]}`}>
          <span style={{ height: `${Math.max(values[i] > 0 ? 12 : 0, barShare(values[i], max) * 100)}%` }} />
        </span>
      ))}
    </span>
  );
}

// ---- metrics panels ----

export function MetricsPanels({
  metrics,
  groups,
  view,
  perProject,
  hues,
  tracked,
  expanded,
  onExpand,
  onRepo,
}: {
  metrics: ActivityMetrics;
  /** The kind filter; the charts draw the groups it lets through. */
  groups: readonly ActivityGroup[];
  view: MetricsView;
  perProject: boolean;
  hues: ReadonlyMap<string, number>;
  tracked: ReadonlySet<string>;
  expanded: boolean;
  onExpand: (expanded: boolean) => void;
  onRepo: (repoId: string) => void;
}) {
  const shown = chartGroups(groups);
  return (
    <section id="activity-metrics" class={`activity-metrics view-${view}`} aria-label="Activity per day, by hour and per project">
      <div class="activity-panel">
        <h3>
          Per day <span>{counts(metrics)}</span>
        </h3>
        {view === "chart" ? (
          <>
            <Legend groups={shown} />
            <DayColumns days={metrics.days} groups={shown} />
          </>
        ) : (
          <DayTable days={metrics.days} groups={shown} />
        )}
      </div>
      <HoursPanel days={metrics.days} view={view} />
      {perProject && (
        <div class="activity-panel wide">
          <h3>
            Per project <span>{plural(metrics.repos.length, "project")}</span>
          </h3>
          {view === "chart" && <Legend groups={shown} />}
          <ProjectRows repos={metrics.repos} groups={shown} view={view} hues={hues} tracked={tracked} expanded={expanded} onRepo={onRepo} />
          {metrics.repos.length > REPOS_SHOWN && (
            <button type="button" class="btn sm ghost activity-more" aria-expanded={expanded} onClick={() => onExpand(!expanded)}>
              {expanded ? "Show fewer" : `Show ${visibleRepos(metrics.repos, false).hidden} more`}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/** Names every group drawn; the colour beside the text carries identity, the text stays in text colours. */
function Legend({ groups }: { groups: readonly ActivityGroup[] }) {
  return (
    <ul class="chart-legend">
      {groups.map((g) => (
        <li key={g}>
          <span class={`chart-key group-${g}`} />
          {GROUP_LABELS[g]}
        </li>
      ))}
    </ul>
  );
}

/** Stacked segments of one total, in group order from the baseline; empty groups draw nothing. */
function Stack({ groups, shown, total }: { groups: ActivityGroupCounts; shown: readonly ActivityGroup[]; total: number }) {
  return (
    <>
      {shown.map((g) =>
        groups[g] > 0 ? <span key={g} class={`chart-seg group-${g}`} style={{ flexGrow: groups[g], flexBasis: 0 }} title={`${GROUP_LABELS[g]}: ${groups[g]}`} /> : null,
      )}
      {total === 0 && <span class="chart-seg empty" />}
    </>
  );
}

function DayColumns({ days, groups }: { days: readonly ActivityDayCount[]; groups: readonly ActivityGroup[] }) {
  const today = dayKey(new Date());
  const totals = days.map((d) => groups.reduce((n, g) => n + d.groups[g], 0));
  const { top, ticks } = axisTicks(Math.max(0, ...totals));
  return (
    <div class="chart-columns" style={{ "--days": String(days.length) }}>
      <div class="chart-plot">
        <ol class="chart-grid" aria-hidden="true">
          {ticks.map((t) => (
            <li key={t} style={{ bottom: `${(t / top) * 100}%` }}>
              <span>{t}</span>
            </li>
          ))}
        </ol>
        <ol class="chart-cols">
          {days.map((d, i) => {
            const title = `${dayTitle(d.day)}${i === 0 ? " (partly kept)" : ""}`;
            const tip = `${title}: ${counts(d)}${totals[i] > 0 ? ` — ${byGroup(d.groups, groups)}` : ""}`;
            return (
              // biome-ignore lint/a11y/noNoninteractiveTabindex: a column is focusable so keyboard users get the same readout as hover
              <li key={d.day} class={`chart-col${d.day === today ? " today" : ""}${i < days.length / 2 ? " left" : " right"}`} tabIndex={0} aria-label={tip}>
                <span class="chart-col-bar" style={{ height: `${(totals[i] / top) * 100}%` }}>
                  {totals[i] > 0 && <span class="chart-cap">{totals[i]}</span>}
                  <span class="chart-col-stack">
                    <Stack groups={d.groups} shown={groups} total={totals[i]} />
                  </span>
                </span>
                <span class="chart-tip" aria-hidden="true">
                  <strong>{title}</strong>
                  {groups.map((g) => (
                    <span key={g} class="chart-tip-row">
                      <span class={`chart-line group-${g}`} />
                      <b>{d.groups[g]}</b> {GROUP_LABELS[g]}
                    </span>
                  ))}
                  <span class="chart-tip-row total">{counts(d)}</span>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
      <ol class="chart-x" aria-hidden="true">
        {days.map((d) => (
          <li key={d.day}>{dayLabel(d.day, today)}</li>
        ))}
      </ol>
    </div>
  );
}

function DayTable({ days, groups }: { days: readonly ActivityDayCount[]; groups: readonly ActivityGroup[] }) {
  return (
    <div class="activity-table-wrap">
      <table class="activity-table">
        <thead>
          <tr>
            <th scope="col">Day</th>
            {groups.map((g) => (
              <th key={g} scope="col">
                {GROUP_LABELS[g]}
              </th>
            ))}
            <th scope="col">Events</th>
            <th scope="col">Changes</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.day}>
              <th scope="row">{dayTitle(d.day)}</th>
              {groups.map((g) => (
                <td key={g}>{d.groups[g]}</td>
              ))}
              <td>{d.events}</td>
              <td>{d.changes}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, h) => h);

/** When the work happened: the window's days by hour of the day, shaded from fewer to more events. */
function HoursPanel({ days, view }: { days: readonly ActivityDayCount[]; view: MetricsView }) {
  const [hover, setHover] = useState<{ day: string; hour: number; n: number }>();
  const today = dayKey(new Date());
  const max = Math.max(0, ...days.flatMap((d) => d.hours));
  const peak = busiestHour(days);
  const readout = hover
    ? `${dayTitle(hover.day)} · ${hourLabel(hover.hour)}–${hourLabel((hover.hour + 1) % 24)} · ${plural(hover.n, "event")}`
    : "Hover a cell for its hour";
  return (
    <div class="activity-panel">
      <h3>
        When <span>{peak === undefined ? "no events" : `busiest at ${hourLabel(peak)}`}</span>
      </h3>
      {view === "chart" ? (
        <>
          <div class="heat" role="img" aria-label={`Events by hour of the day${peak === undefined ? "" : `, busiest at ${hourLabel(peak)}`}; the table view lists every hour`} onPointerLeave={() => setHover(undefined)}>
            {days.map((d) => (
              <div key={d.day} class="heat-row">
                <span class="heat-day">{dayLabel(d.day, today)}</span>
                {HOURS.map((h) => {
                  const n = d.hours[h] ?? 0;
                  return (
                    <span
                      key={h}
                      class={`heat-cell step-${heatStep(n, max)}${hover?.day === d.day && hover.hour === h ? " on" : ""}`}
                      title={`${dayTitle(d.day)}, ${hourLabel(h)}: ${plural(n, "event")}`}
                      onPointerEnter={() => setHover({ day: d.day, hour: h, n })}
                    />
                  );
                })}
              </div>
            ))}
            <div class="heat-row heat-hours" aria-hidden="true">
              <span class="heat-day" />
              {HOURS.map((h) => (
                <span key={h}>{h % 6 === 0 ? String(h).padStart(2, "0") : ""}</span>
              ))}
            </div>
          </div>
          <div class="heat-foot">
            <span class="heat-readout" aria-live="polite">
              {readout}
            </span>
            <span class="heat-scale" aria-hidden="true">
              Fewer
              {[0, 1, 2, 3, 4].map((s) => (
                <span key={s} class={`heat-cell step-${s}`} />
              ))}
              More
            </span>
          </div>
        </>
      ) : (
        <div class="activity-table-wrap">
          <table class="activity-table">
            <thead>
              <tr>
                <th scope="col">Day</th>
                <th scope="col">Hours with events</th>
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const busy = HOURS.filter((h) => (d.hours[h] ?? 0) > 0);
                return (
                  <tr key={d.day}>
                    <th scope="row">{dayTitle(d.day)}</th>
                    <td class="text">{busy.length === 0 ? "—" : busy.map((h) => `${hourLabel(h)} ${d.hours[h]}`).join(" · ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ProjectRows({
  repos,
  groups,
  view,
  hues,
  tracked,
  expanded,
  onRepo,
}: {
  repos: readonly ActivityRepoCount[];
  groups: readonly ActivityGroup[];
  view: MetricsView;
  hues: ReadonlyMap<string, number>;
  tracked: ReadonlySet<string>;
  expanded: boolean;
  onRepo: (repoId: string) => void;
}) {
  const { shown } = visibleRepos(repos, expanded);
  const busiest = repos[0]?.events ?? 0;
  const name = (r: ActivityRepoCount) => {
    const isTracked = tracked.has(r.repoId);
    const label = (
      <span class={`repo ${isTracked ? "repo-tint" : "is-untracked"}`} style={isTracked ? repoHue(hues.get(r.repoId) ?? 0) : undefined}>
        <span class="swatch" />
        {r.repoName}
      </span>
    );
    return isTracked ? (
      <button type="button" class="activity-repo-name" title={`Show only ${r.repoName}`} onClick={() => onRepo(r.repoId)}>
        {label}
      </button>
    ) : (
      <span class="activity-repo-name" title="No longer tracked">
        {label}
      </span>
    );
  };
  if (view === "table") {
    return (
      <div class="activity-table-wrap">
        <table class="activity-table">
          <thead>
            <tr>
              <th scope="col">Project</th>
              {groups.map((g) => (
                <th key={g} scope="col">
                  {GROUP_LABELS[g]}
                </th>
              ))}
              <th scope="col">Events</th>
              <th scope="col">Changes</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.repoId}>
                <th scope="row">{name(r)}</th>
                {groups.map((g) => (
                  <td key={g}>{r.groups[g]}</td>
                ))}
                <td>{r.events}</td>
                <td>{r.changes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <ol class="activity-repo-bars">
      {shown.map((r) => {
        const total = groups.reduce((n, g) => n + r.groups[g], 0);
        return (
          <li key={r.repoId} class="activity-repo-row">
            {name(r)}
            {/* biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users get the same readout as hover */}
            <span class="activity-repo-track" role="img" tabIndex={0} aria-label={`${r.repoName}: ${counts(r)} — ${byGroup(r.groups, groups)}`}>
              <span class="activity-repo-stack" style={{ width: `${barShare(r.events, busiest) * 100}%` }}>
                <Stack groups={r.groups} shown={groups} total={total} />
              </span>
              <span class="chart-tip below" aria-hidden="true">
                <strong>{r.repoName}</strong>
                {groups.map((g) => (
                  <span key={g} class="chart-tip-row">
                    <span class={`chart-line group-${g}`} />
                    <b>{r.groups[g]}</b> {GROUP_LABELS[g]}
                  </span>
                ))}
              </span>
            </span>
            <span class="activity-repo-counts">{counts(r)}</span>
          </li>
        );
      })}
    </ol>
  );
}
