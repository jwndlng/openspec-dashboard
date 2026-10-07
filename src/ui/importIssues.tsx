// Import from issues (openspec/specs/issue-import): a repository's open GitHub issues, fetched when the dialog opens or
// on Refresh and nowhere else, from which the user checks the ones to import as changes. Checking, renaming and
// filtering write nothing; importing sends one create request per issue, carrying the issue, through the same route
// the New change form uses.
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { issueChangeName, issueRef, issueUrl } from "../shared/issues.ts";
import type { ChangeSnapshot, GithubIssue, RepoIssues, SourceIssue } from "../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { relTime } from "./format.ts";
import { IconCircleDot, IconRefresh } from "./icons.tsx";
import { filterIssues, importedIssues, type ImportResult, importIssues, type ImportRow, rowProblems } from "./importIssuesState.ts";
import { Modal } from "./modal.tsx";

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : err instanceof Error ? err.message : String(err));
const plural = (n: number) => `${n} ${n === 1 ? "change" : "changes"}`;

/** Only what the dialog needs to know about the repository; the changes decide which names are taken and what is imported. */
export interface ImportTarget {
  repoId: string;
  repoName: string;
  changes: Pick<ChangeSnapshot, "name" | "sourceIssue">[];
}

function IssueImport({ target, onClose, onImported, onBusy }: { target: ImportTarget; onClose: () => void; onImported: () => void; onBusy: (busy: boolean) => void }) {
  const [list, setList] = useState<RepoIssues | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Issue number → its (editable) change name; insertion order is the order the user checked them in.
  const [checked, setChecked] = useState<Map<number, string>>(new Map());
  const [busy, setBusyState] = useState(false);
  const [working, setWorking] = useState<number | null>(null);
  const [results, setResults] = useState<ImportResult[] | null>(null);
  const filterRef = useRef<HTMLInputElement>(null);
  const setBusy = (next: boolean) => {
    setBusyState(next);
    onBusy(next);
  };

  // The only places the issue query runs: the dialog opening, and Refresh.
  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      setList(await api.listIssues(target.repoId));
    } catch (err) {
      setLoadError(errorText(err));
    } finally {
      setLoading(false);
    }
  };
  // Fetched once, when the dialog opens — never again on its own.
  useEffect(() => {
    void load();
    filterRef.current?.focus();
  }, []);

  const imported = useMemo(() => importedIssues(target.changes, list?.github), [target.changes, list?.github]);
  const taken = useMemo(() => new Set(target.changes.map((c) => c.name)), [target.changes]);
  const issues = list?.status === "ok" ? list.issues : [];
  const shown = filterIssues(issues, query);
  // Checked issues in list order, dropping any that disappeared on Refresh or became imported meanwhile.
  const rows: ImportRow[] = issues.filter((i) => checked.has(i.number) && !imported.has(i.number)).map((issue) => ({ issue, name: checked.get(issue.number) ?? "" }));
  const problems = rowProblems(rows, taken);
  const problemOf = new Map(rows.map((r, i) => [r.issue.number, problems[i]]));
  const canImport = rows.length > 0 && problems.every((p) => p === null) && !busy && list?.github !== undefined;

  const toggle = (issue: GithubIssue) => {
    const next = new Map(checked);
    if (next.has(issue.number)) next.delete(issue.number);
    else next.set(issue.number, issueChangeName(issue.title, issue.number));
    setChecked(next);
  };
  const rename = (number: number, name: string) => setChecked(new Map(checked).set(number, name));

  const onSubmit = async (event: Event) => {
    event.preventDefault();
    if (!canImport || !list?.github) return;
    setBusy(true);
    const done = await importIssues(target.repoId, list.github, rows, setWorking);
    setResults(done);
    setWorking(null);
    setBusy(false);
    if (done.some((r) => r.ok)) onImported();
  };

  if (results) {
    const created = results.filter((r) => r.ok).length;
    return (
      <div class="new-change issue-import">
        <p class="new-change-summary">
          {created} of {plural(results.length)} imported.
        </p>
        <ul class="new-change-results" aria-label="Result per issue">
          {results.map((r) => (
            <li key={r.number} class={r.ok ? "ok" : "refused"}>
              <span class="repo">#{r.number}</span>
              <span class="mono">{r.name}</span>
              <span class="outcome">{r.ok ? (r.staged ? "created and staged" : "created, not staged") : `refused: ${r.message}`}</span>
            </li>
          ))}
        </ul>
        <div class="row actions">
          <button type="button" class="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    );
  }

  const unavailable = list && list.status !== "ok";
  return (
    <form class="new-change issue-import" onSubmit={onSubmit}>
      <div class="row issue-import-bar">
        <input
          ref={filterRef}
          class="input"
          type="search"
          placeholder="Filter by number, title or label"
          aria-label="Filter issues"
          value={query}
          disabled={busy}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        />
        <button type="button" class="btn ghost" onClick={() => void load()} disabled={loading || busy} aria-busy={loading} title="Ask GitHub again for the open issues">
          <IconRefresh size={14} />
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>
      <p class="hint issue-import-status" aria-live="polite">
        {loading && !list ? "Asking GitHub for the open issues…" : null}
        {list?.status === "ok" && (
          <>
            {list.issues.length} open {list.issues.length === 1 ? "issue" : "issues"} in <span class="mono">{list.github}</span>
            {list.fetchedAt ? `, fetched ${relTime(list.fetchedAt) === "just now" ? "just now" : `${relTime(list.fetchedAt)} ago`}` : ""}
            {list.truncated ? " — only the newest 100 are listed" : ""}
          </>
        )}
      </p>
      {loadError && <div class="notice danger">Could not list issues: {loadError}</div>}
      {unavailable && (
        <div class={`notice ${list.status === "failed" ? "danger" : "warn"}`}>
          {list.status === "failed" ? "Listing issues failed: " : "Issues cannot be listed: "}
          {list.reason}
          {list.setup === "gh-signed-out" && <> Sign in once in a terminal with <code>gh auth login</code>, then Refresh.</>}
          {list.setup === "gh-missing" && <> Install the GitHub CLI (<code>gh</code>) and sign in with <code>gh auth login</code>, then Refresh.</>}
        </div>
      )}
      {list?.status === "ok" && (
        <ul class="issue-import-list" aria-label="Open issues">
          {shown.length === 0 && <li class="empty hint">{issues.length === 0 ? "No open issues." : "No issue matches the filter."}</li>}
          {shown.map((issue) => {
            const importedAs = imported.get(issue.number);
            const isChecked = checked.has(issue.number) && importedAs === undefined;
            const problem = problemOf.get(issue.number);
            return (
              <li key={issue.number} class={`${importedAs ? "imported" : ""} ${working === issue.number ? "working" : ""}`}>
                <div class="issue-import-row">
                  <input
                    type="checkbox"
                    id={`issue-${issue.number}`}
                    checked={isChecked}
                    disabled={importedAs !== undefined || busy}
                    onChange={() => toggle(issue)}
                    aria-label={`Import #${issue.number} ${issue.title}`}
                  />
                  <span class="issue-number mono">#{issue.number}</span>
                  <a class="issue-title" href={issue.url} target="_blank" rel="noopener noreferrer" title="Open the issue on GitHub">
                    {issue.title || `Issue #${issue.number}`}
                  </a>
                  {issue.labels.map((l) => (
                    <span key={l} class="badge">
                      {l}
                    </span>
                  ))}
                  <span class="hint issue-meta">
                    {issue.author ? `${issue.author} · ` : ""}
                    {relTime(issue.createdAt)}
                  </span>
                </div>
                {importedAs && (
                  <p class="hint issue-imported">
                    imported as <span class="mono">{importedAs}</span>
                  </p>
                )}
                {isChecked && (
                  <label class="issue-import-name">
                    <span>Change name</span>
                    <input class="input" value={checked.get(issue.number)} disabled={busy} aria-invalid={problem ? true : undefined} onInput={(e) => rename(issue.number, (e.target as HTMLInputElement).value)} />
                    {problem && <span class="hint danger">{problem}</span>}
                    {working === issue.number && <span class="hint">importing…</span>}
                  </label>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div class="row actions">
        <button type="submit" class="btn primary" disabled={!canImport}>
          {busy ? "Importing…" : rows.length === 0 ? "Import" : `Import ${plural(rows.length)}`}
        </button>
        <button type="button" class="btn ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * The issue a change was imported from, as `#42` linking to GitHub in a new tab; the repository and title are in the
 * tooltip. The URL is built from `owner/name` and the number, never read from the file — and the page never requests it.
 */
export function SourceIssueLink({ issue, place }: { issue: SourceIssue; place: "card" | "detail" }) {
  const title = `Imported from ${issueRef(issue)}${issue.title ? ` — ${issue.title}` : ""}; open on GitHub`;
  return (
    <a class={place === "card" ? "card-issue" : "badge detail-issue"} href={issueUrl(issue)} target="_blank" rel="noopener noreferrer" title={title} aria-label={`Imported from issue ${issueRef(issue)}, opens on GitHub`}>
      <IconCircleDot size={11} />#{issue.number}
    </a>
  );
}

/** The dialog over the page. None of the ways to close it applies while issues are being imported. */
export function ImportIssuesDialog({ target, onClose, onImported }: { target: ImportTarget; onClose: () => void; onImported: () => void }) {
  const busy = useRef(false);
  return (
    <Modal
      label={`Import issues into ${target.repoName}`}
      title="Import from issues"
      subtitle={<span class="mono">{target.repoName}/openspec/changes/&lt;name&gt;/</span>}
      icon={<IconCircleDot size={18} />}
      onClose={onClose}
      canClose={() => !busy.current}
      wide
    >
      <IssueImport
        target={target}
        onClose={() => {
          if (!busy.current) onClose();
        }}
        onImported={onImported}
        onBusy={(next) => {
          busy.current = next;
        }}
      />
    </Modal>
  );
}
