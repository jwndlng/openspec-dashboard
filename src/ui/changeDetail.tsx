// One change with its artifacts. The header comes from the snapshot the boards use; file lists and file text are
// fetched on demand from the read-only artifact endpoints. Nothing here writes anywhere.
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import type { ChangeArtifactEntry, ChangeArtifacts, ChangeSnapshot, RepoSnapshot, Snapshot, TaskProgress } from "../shared/types.ts";
import { ApiError, api } from "./api.ts";
import { applyCommand, cdCommand, relTime } from "./format.ts";
import { BranchBadge } from "./checkout.tsx";
import { CopyButton, Meter } from "./kanban.tsx";
import { renderMarkdown } from "./markdown.tsx";
import { backTarget, type DetailQuery, parseDetailQuery, repoPath, serializeDetailQuery } from "./routes.ts";
import { currentQuery, followInApp, href, replaceQuery } from "./url.ts";

export function artifactLabel(id: string): string {
  return id.replace(/[-_]+/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export interface Selection {
  artifactId?: string;
  file?: string;
}

/**
 * What is on screen for a URL: the named artifact and file when they exist, otherwise the first artifact that has
 * content and its first file. A stale link therefore never produces an error.
 */
export function resolveSelection(artifacts: ChangeArtifactEntry[], query: Pick<DetailQuery, "artifact" | "file">): Selection {
  const withContent = artifacts.filter((a) => a.files.length > 0);
  const artifact = withContent.find((a) => a.id === query.artifact) ?? withContent[0];
  if (!artifact) return {};
  const file = artifact.files.find((f) => f.path === query.file) ?? artifact.files[0];
  return { artifactId: artifact.id, file: file.path };
}

/** Same line shape the scanner counts, so the checklist's label cannot disagree with the boxes below it. */
export function taskProgress(markdown: string): TaskProgress {
  const boxes = markdown.match(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/gm) ?? [];
  return { done: boxes.filter((b) => !b.endsWith("[ ]")).length, total: boxes.length };
}

export function absoluteFilePath(changeDir: string, file: string): string {
  return `${changeDir.replace(/\/+$/, "")}/${file}`;
}

export type FileState =
  | { status: "ok"; path: string; text: string }
  | { status: "too-large"; path: string; message: string }
  | { status: "error"; path: string; message: string };

/** The previous state when nothing changed, so an unchanged poll re-renders nothing and the scroll position stays. */
export function nextFileState(prev: FileState | null, next: FileState): FileState {
  if (!prev || prev.status !== next.status || prev.path !== next.path) return next;
  if (prev.status === "ok" && next.status === "ok") return prev.text === next.text ? prev : next;
  return (prev as { message: string }).message === (next as { message: string }).message ? prev : next;
}

export function nextListing(prev: ChangeArtifacts | null, next: ChangeArtifacts): ChangeArtifacts {
  return prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
}

export function fileFailure(path: string, err: unknown): FileState {
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof ApiError && err.status === 413) return { status: "too-large", path, message };
  return { status: "error", path, message };
}

function AppLink({ path, query = "", class: className, children }: { path: string; query?: string; class?: string; children: ComponentChildren }) {
  return (
    <a class={className} href={href(path, undefined, query)} onClick={(e) => followInApp(e, path, query)}>
      {children}
    </a>
  );
}

export function ChangeNotFound({ repo, repoId, changeName }: { repo?: RepoSnapshot; repoId: string; changeName: string }) {
  return (
    <div class="empty">
      <h1>Change not found</h1>
      {repo ? (
        <p>
          <strong>{repo.name}</strong> has no change named <code>{changeName}</code>. It may have been renamed or removed.
        </p>
      ) : (
        <p>
          No tracked repository with the id <code>{repoId}</code>, so the change <code>{changeName}</code> cannot be shown.
        </p>
      )}
      <AppLink class="btn primary" path="/">
        Back to Projects
      </AppLink>
    </div>
  );
}

export function DetailHeader({ repo, change, from, selectedFilePath, now }: { repo: RepoSnapshot; change: ChangeSnapshot; from?: string; selectedFilePath?: string; now: number }) {
  const back = backTarget(from, repo.id);
  return (
    <div class="repo-head detail-head">
      <div class="row">
        <AppLink class="crumb-link back" path={back.path} query={back.query}>
          ← Back to board
        </AppLink>
      </div>
      <div class="row">
        <h1 class="crumbs">
          <AppLink class="crumb-link" path={repoPath(repo.id)}>
            {repo.name}
          </AppLink>
          <span class="sep">/</span>
          <span class="mono change-name">{change.name}</span>
        </h1>
        <span class="badge">{change.column}</span>
        {change.branchMatch && <BranchBadge branch={change.branchMatch} hint="a branch or worktree matches this change" />}
      </div>
      <div class="row">
        {change.tasks && change.tasks.total > 0 && (
          <div class="detail-meter">
            <Meter done={change.tasks.done} total={change.tasks.total} />
          </div>
        )}
        <span class="badge" title={change.lastActivityAt ? `last activity ${change.lastActivityAt}` : "no activity date"}>
          {relTime(change.lastActivityAt, now)} ago
        </span>
        {change.created && <span class="badge">created {change.created}</span>}
        {change.archived && <span class="badge">archived {change.archived}</span>}
        <span class="badge mono">{change.schema}</span>
      </div>
      <div class="row detail-actions">
        {/* Like the card: apply where the change lives, which for a change in a worktree is the worktree. */}
        {!change.archived && <CopyButton text={applyCommand(change.checkout?.path ?? repo.path, change.name)} label="Copy apply command" />}
        <CopyButton text={cdCommand(repo.path)} label="Copy cd command" />
        {selectedFilePath && <CopyButton text={selectedFilePath} label="Copy file path" />}
      </div>
      {change.warnings?.map((w) => (
        <div key={w} class="notice warn">
          {w}
        </div>
      ))}
    </div>
  );
}

export function ArtifactTabs({ artifacts, selected, onSelect }: { artifacts: ChangeArtifactEntry[]; selected?: string; onSelect: (id: string) => void }) {
  return (
    <div class="detail-tabs" role="tablist" aria-label="Artifacts">
      {artifacts.map((a) => {
        const empty = a.files.length === 0;
        return (
          <button
            key={a.id}
            type="button"
            role="tab"
            class={`detail-tab ${a.id === selected ? "on" : ""}`}
            aria-selected={a.id === selected}
            disabled={empty}
            title={empty ? `not written yet — ${a.status}` : undefined}
            onClick={() => onSelect(a.id)}
          >
            {artifactLabel(a.id)}
            <span class={`state ${a.status}`}>{a.status}</span>
          </button>
        );
      })}
    </div>
  );
}

export function FileList({ artifact, selected, onSelect }: { artifact: ChangeArtifactEntry; selected?: string; onSelect: (path: string) => void }) {
  if (artifact.files.length < 2) return null;
  return (
    <nav class="detail-files" aria-label={`Files of ${artifactLabel(artifact.id)}`}>
      {artifact.files.map((f) => (
        <button key={f.path} type="button" class={`detail-file mono ${f.path === selected ? "on" : ""}`} aria-current={f.path === selected ? "true" : undefined} onClick={() => onSelect(f.path)}>
          {f.path}
        </button>
      ))}
    </nav>
  );
}

/** The content column for one file state. `rendered` is the memoised Markdown of `state.text`. */
export function FileContent({ state, raw, isTasks, rendered, filePath }: { state: FileState; raw: boolean; isTasks: boolean; rendered: ComponentChildren; filePath?: string }) {
  if (state.status === "too-large") {
    return (
      <div class="notice warn detail-problem">
        <p>
          <code>{state.path}</code> is too large to display here ({state.message}).
        </p>
        {filePath && <CopyButton text={filePath} label="Copy file path" />}
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div class="notice danger detail-problem">
        Could not read <code>{state.path}</code>: {state.message}
      </div>
    );
  }
  const progress = isTasks ? taskProgress(state.text) : undefined;
  return (
    <>
      {progress && progress.total > 0 && (
        <div class="detail-meter wide">
          <Meter done={progress.done} total={progress.total} />
        </div>
      )}
      {raw ? <pre class="detail-raw">{state.text}</pre> : rendered}
    </>
  );
}

export function ChangeDetail({ snapshot, repoId, changeName }: { snapshot: Snapshot | null; repoId: string; changeName: string }) {
  const [query, setQueryState] = useState<DetailQuery>(() => parseDetailQuery(currentQuery()));
  const [listing, setListing] = useState<ChangeArtifacts | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [fileState, setFileState] = useState<FileState | null>(null);

  const setQuery = (patch: Partial<DetailQuery>) => {
    const next = { ...query, ...patch };
    setQueryState(next);
    replaceQuery(serializeDetailQuery(next));
  };

  const repo = snapshot?.repos.find((r) => r.id === repoId);
  const change = repo?.changes.find((c) => c.name === changeName);
  const known = change !== undefined;

  // `snapshot` is a new object after every poll and every manual refresh, so both fetches follow the regular refresh.
  useEffect(() => {
    if (!known) return;
    let cancelled = false;
    api.changeArtifacts(repoId, changeName).then(
      (next) => {
        if (cancelled) return;
        setListing((prev) => nextListing(prev, next));
        setListError(null);
      },
      (err) => !cancelled && setListError(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      cancelled = true;
    };
  }, [repoId, changeName, known, snapshot]);

  const selection = useMemo(() => resolveSelection(listing?.artifacts ?? [], query), [listing, query]);
  const file = selection.file;

  useEffect(() => {
    if (!known || !file) return;
    let cancelled = false;
    api.artifactFile(repoId, changeName, file).then(
      (content) => !cancelled && setFileState((prev) => nextFileState(prev, { status: "ok", path: file, text: content.text })),
      (err) => !cancelled && setFileState((prev) => nextFileState(prev, fileFailure(file, err))),
    );
    return () => {
      cancelled = true;
    };
  }, [repoId, changeName, known, file, snapshot]);

  const text = fileState?.status === "ok" ? fileState.text : undefined;
  const rendered = useMemo(() => (text === undefined ? null : renderMarkdown(text)), [text]);

  if (!snapshot) return <div class="empty">Loading…</div>;
  if (!repo || !change) return <ChangeNotFound repo={repo} repoId={repoId} changeName={changeName} />;

  const artifact = listing?.artifacts.find((a) => a.id === selection.artifactId);
  const filePath = listing && file ? absoluteFilePath(listing.change.dir, file) : undefined;
  const current = fileState && fileState.path === file ? fileState : null;

  return (
    <div class="detail">
      <DetailHeader repo={repo} change={change} from={query.from} selectedFilePath={filePath} now={Date.now()} />
      {listing && <ArtifactTabs artifacts={listing.artifacts} selected={selection.artifactId} onSelect={(id) => setQuery({ artifact: id, file: undefined })} />}
      <div class="detail-body">
        {artifact && <FileList artifact={artifact} selected={file} onSelect={(path) => setQuery({ artifact: artifact.id, file: path })} />}
        <section class="detail-content">
          {file && (
            <div class="detail-toolbar">
              <code class="path">{file}</code>
              <label class="check">
                <input type="checkbox" checked={query.raw} onChange={(e) => setQuery({ raw: e.currentTarget.checked })} />
                raw
              </label>
            </div>
          )}
          {listError && !listing ? (
            <div class="notice danger detail-problem">Could not read this change's artifacts: {listError}</div>
          ) : !listing ? (
            <p class="detail-hint">Loading…</p>
          ) : !file ? (
            <p class="detail-hint">This change has no artifacts yet — nothing has been written to its directory.</p>
          ) : !current ? (
            <p class="detail-hint">Loading…</p>
          ) : (
            <FileContent state={current} raw={query.raw} isTasks={selection.artifactId === "tasks"} rendered={rendered} filePath={filePath} />
          )}
        </section>
      </div>
    </div>
  );
}
