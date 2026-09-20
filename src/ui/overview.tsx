import { useMemo, useState } from "preact/hooks";
import { boardColumns } from "../shared/columns.ts";
import type { Config, Snapshot } from "../shared/types.ts";
import { NoRepos } from "./empty.tsx";
import { relTime } from "./format.ts";
import { filterRows, type OverviewRow, type OverviewState, overviewRows, parseOverviewState, type SortKey, serializeOverviewState, sortRows, toggleSort } from "./overviewState.ts";
import { repoPath } from "./routes.ts";
import { summarize } from "./sharedConfigState.ts";
import { currentQuery, href, navigate, replaceQuery } from "./url.ts";

/** Plain left-click only, so modifier-clicks and text selection keep their browser behaviour. */
function isPlainClick(e: MouseEvent): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

function Row({ row, stages, now }: { row: OverviewRow; stages: string[]; now: number }) {
  const path = repoPath(row.id);
  const idle = row.open === 0;
  // Profile ids rather than names: they are readable slugs and need no extra request here.
  const shared = summarize(row.sharedConfig, []);
  return (
    <tr
      class={idle ? "idle" : ""}
      title={`${row.path} · ${row.archived} archived`}
      onClick={(e) => {
        if (!isPlainClick(e) || getSelection()?.toString()) return;
        navigate(path);
      }}
    >
      <th scope="row" class="repo-name">
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
        {row.hint && <span class="path-hint mono">{row.hint}/</span>}
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
          <td class="num">{row.toArchive > 0 ? <span class="badge warn">{row.toArchive} to archive</span> : <span class="zero">·</span>}</td>
        </>
      )}
      <td class="when" title={row.lastUpdatedAt ?? "no activity date"}>
        {row.lastUpdatedAt ? `${relTime(row.lastUpdatedAt, now)} ago`.replace("just now ago", "just now") : "—"}
      </td>
    </tr>
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
  const visible = useMemo(() => sortRows(filterRows(rows, state.q), state.sort, state.dir), [rows, state]);

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
        </div>
        <span class="spacer" style={{ flex: 1 }} />
        <span class="badge mono">
          {rows.length} tracked · {rows.reduce((n, r) => n + r.open, 0)} open · {rows.reduce((n, r) => n + r.toArchive, 0)} to archive
        </span>
      </div>
      <div class="overview">
        <table class="projects">
          <thead>
            <tr>
              {header("name", "Repository")}
              {stages.map((s) => (
                <th key={s} scope="col" class="num stage">
                  {s}
                </th>
              ))}
              {header("open", "Open", "num")}
              {header("archive", "To archive", "num")}
              {header("updated", "Last updated", "when")}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <Row key={row.id} row={row} stages={stages} now={now} />
            ))}
          </tbody>
        </table>
        {snapshot && visible.length === 0 && <p class="hint">No repository matches “{state.q}”.</p>}
      </div>
    </>
  );
}
