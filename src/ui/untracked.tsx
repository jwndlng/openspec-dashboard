// The projects overview's Untracked & disabled section: everything the user can bring into the overview — disabled
// repositories, discovered OpenSpec repositories and git repositories without OpenSpec — with Enable, Ignore and
// Integrate, each saved at once. The view is hook-free so tests can walk it; `useTracking` holds what changes.
import { useState } from "preact/hooks";
import type { Config } from "../shared/types.ts";
import { api } from "./api.ts";
import { IconEyeOff } from "./icons.tsx";
import type { DiscoveryState } from "./discoveryState.ts";
import type { UntrackedEntry, UntrackedKind } from "./overviewState.ts";
import { useSessionUi } from "./sessions.tsx";
import { followInApp, hrefWithQuery } from "./url.ts";

export type TrackingAction = "enable" | "disable" | "ignore" | "integrate";

/** The overview's tracking actions and their per-repository state, keyed by repository id. */
export interface Tracking {
  busy: Record<string, TrackingAction>;
  errors: Record<string, string>;
  enable(entry: UntrackedEntry): void;
  disable(id: string): void;
  ignore(entry: UntrackedEntry): void;
  integrate(entry: UntrackedEntry): void;
}

/**
 * Runs one action per repository at a time. A saved config goes straight to the app shell, so the repository moves
 * between the tracked list and the section before any scan; Enable and Ignore also re-run discovery, whose answer
 * changed with the config.
 */
export function useTracking({ onConfig, rediscover }: { onConfig: (config: Config) => void; rediscover: () => void }): Tracking {
  const ui = useSessionUi();
  const [busy, setBusy] = useState<Record<string, TrackingAction>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const run = async (id: string, action: TrackingAction, work: () => Promise<void>) => {
    if (busy[id]) return;
    setBusy((b) => ({ ...b, [id]: action }));
    setErrors(({ [id]: _old, ...rest }) => rest);
    try {
      await work();
    } catch (err) {
      // The entry stays where it was; the reason is shown on it.
      setErrors((e) => ({ ...e, [id]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBusy(({ [id]: _done, ...rest }) => rest);
    }
  };
  const save = (then?: () => void) => async (config: Config) => {
    onConfig(config);
    then?.();
  };
  return {
    busy,
    errors,
    enable: (entry) => void run(entry.id, "enable", () => api.trackRepo(entry.path).then(save(rediscover))),
    disable: (id) => void run(id, "disable", () => api.setRepoEnabled(id, false).then(save())),
    ignore: (entry) => void run(entry.id, "ignore", () => api.ignorePath(entry.path).then(save(rediscover))),
    integrate: (entry) =>
      void run(entry.id, "integrate", async () => {
        const session = await api.startIntegration(entry.path);
        await ui.refresh();
        ui.showIntegration(session.id);
      }),
  };
}

const GROUPS: Record<UntrackedKind, { title: string; hint: string }> = {
  disabled: { title: "Disabled", hint: "Tracked, but switched off: not scanned and not on the boards." },
  discovered: { title: "Discovered", hint: "Use OpenSpec and wait to be tracked." },
  integratable: {
    title: "Without OpenSpec",
    hint: "Git repositories that do not use OpenSpec yet. Integrate starts your agent in the repository to run openspec init there — in the checkout itself, with no branch and no undo; it is tracked once openspec/config.yaml exists.",
  },
};

export const IGNORE_HINT = "Add this path to the ignored paths, saved at once — remove it under Settings › Workspace roots to undo";

export interface UntrackedSectionProps {
  /** After search; grouped and ordered by `untrackedEntries`. */
  entries: UntrackedEntry[];
  discovery: DiscoveryState;
  hasRoots: boolean;
  /** The overview's search, for the "nothing matches" text. */
  query: string;
  tracking: Tracking;
  /** Why Integrate cannot be offered at all; stated once for the section. */
  integrateOff?: string;
  /** The running integration session for a folder, if any. */
  runningIntegration: (path: string) => string | undefined;
  showIntegration: (id: string) => void;
  onRediscover: () => void;
}

function SettingsRootsLink({ children }: { children: string }) {
  return (
    <a href={hrefWithQuery("/settings", "?section=roots")} onClick={(e) => followInApp(e, "/settings", "?section=roots")}>
      {children}
    </a>
  );
}

function Entry({ entry, props }: { entry: UntrackedEntry; props: UntrackedSectionProps }) {
  const { tracking, integrateOff } = props;
  const busy = tracking.busy[entry.id];
  const error = tracking.errors[entry.id];
  const running = entry.kind === "integratable" ? props.runningIntegration(entry.path) : undefined;
  return (
    <li class={`untracked-entry ${entry.kind}`}>
      <span class="untracked-name">{entry.name}</span>
      {entry.hint && <span class="untracked-meta path-hint mono">{entry.hint}/</span>}
      {entry.sameRemoteAs && (
        <span class="untracked-meta badge" title={`same origin remote as:\n${entry.sameRemoteAs.map((r) => `${r.path}${r.tracked ? " (tracked)" : ""}`).join("\n")}`}>
          same remote as {[...new Set(entry.sameRemoteAs.map((r) => r.name))].join(", ")}
        </span>
      )}
      <code class="untracked-path" title={entry.path}>
        {entry.path}
      </code>
      <span class="untracked-actions">
        {entry.kind === "integratable" ? (
          running ? (
            <button type="button" class="btn sm" onClick={() => props.showIntegration(running)}>
              Setting up…
            </button>
          ) : (
            <button
              type="button"
              class="btn sm"
              disabled={integrateOff !== undefined || busy !== undefined}
              title={integrateOff ?? `Run openspec init in ${entry.path}`}
              onClick={() => tracking.integrate(entry)}
            >
              {busy === "integrate" ? "Starting…" : "Integrate"}
            </button>
          )
        ) : (
          <button
            type="button"
            class="btn sm"
            disabled={busy !== undefined}
            title={entry.kind === "disabled" ? "Switch it back on, saved at once" : "Track this repository, saved at once"}
            onClick={() => tracking.enable(entry)}
          >
            {busy === "enable" ? "Enabling…" : "Enable"}
          </button>
        )}
        {entry.kind !== "disabled" && (
          <button type="button" class="btn sm ghost" disabled={busy !== undefined} title={IGNORE_HINT} onClick={() => tracking.ignore(entry)}>
            {busy === "ignore" ? "Ignoring…" : "Ignore"}
          </button>
        )}
      </span>
      {error && (
        <span class="untracked-error" role="alert">
          {error}
        </span>
      )}
    </li>
  );
}

/** Below the tracked repositories: what can be brought in, in three headed groups, empty ones left out. */
export function UntrackedSection(props: UntrackedSectionProps) {
  const { entries, discovery, hasRoots, query } = props;
  const groups = (["disabled", "discovered", "integratable"] as const)
    .map((kind) => ({ kind, entries: entries.filter((e) => e.kind === kind) }))
    .filter((g) => g.entries.length > 0);
  const rootErrors = discovery.result?.errors ?? [];
  const anyIntegratable = entries.some((e) => e.kind === "integratable");
  return (
    <section class="untracked" aria-labelledby="untracked-title">
      <header class="untracked-head">
        <h2 id="untracked-title" class="untracked-title">
          Untracked &amp; disabled <span class="untracked-count">· {entries.length}</span>
        </h2>
        {discovery.running && <span class="hint">discovering…</span>}
        <span class="spacer" />
        {hasRoots && (
          <button type="button" class="btn sm" onClick={props.onRediscover} disabled={discovery.running}>
            {discovery.running ? "Discovering…" : "Rediscover"}
          </button>
        )}
      </header>
      {!hasRoots && (
        <p class="hint">
          No workspace root yet: <SettingsRootsLink>add one in Settings</SettingsRootsLink> to discover the repositories under it.
        </p>
      )}
      {rootErrors.map((e) => (
        <div class="notice warn" key={e.root}>
          {e.root}: {e.message} — <SettingsRootsLink>check the workspace roots</SettingsRootsLink>
        </div>
      ))}
      {discovery.error && <div class="notice danger">Discovery failed: {discovery.error}</div>}
      {anyIntegratable && props.integrateOff && <div class="notice">Integrate is unavailable: {props.integrateOff}.</div>}
      {groups.map((group) => (
        <div class="untracked-group" key={group.kind}>
          <h3 class="untracked-group-title">
            {GROUPS[group.kind].title} <span class="untracked-count">· {group.entries.length}</span>
          </h3>
          <p class="hint">{GROUPS[group.kind].hint}</p>
          <ul class="untracked-list">
            {group.entries.map((entry) => (
              <Entry key={entry.id} entry={entry} props={props} />
            ))}
          </ul>
        </div>
      ))}
      {groups.length === 0 && hasRoots && !discovery.running && (
        <p class="hint">
          {query.trim()
            ? `No untracked repository matches “${query}”.`
            : discovery.result
              ? "Nothing to bring in: every repository under the workspace roots is tracked."
              : ""}
        </p>
      )}
    </section>
  );
}

/**
 * A tracked repository's Disable: saved at once, and never opens the repository the row or tile stands for. An icon to
 * keep the table's width; the accessible name and the tooltip say what it does.
 */
export function DisableButton({ id, name, tracking }: { id: string; name: string; tracking: Tracking }) {
  const busy = tracking.busy[id];
  const error = tracking.errors[id];
  return (
    <span class="disable">
      <button
        type="button"
        class="btn sm ghost icon-only"
        title={`Disable: stop tracking ${name}: no more scans, off the boards. It is listed under Disabled below, where Enable brings it back.`}
        aria-label={`Disable ${name}`}
        disabled={busy !== undefined}
        onClick={(e) => {
          e.stopPropagation(); // in an overview row or tile, a click must not open the repository
          tracking.disable(id);
        }}
      >
        {busy === "disable" ? "Disabling…" : <IconEyeOff />}
      </button>
      {error && (
        <span class="disable-error" role="alert" title={error}>
          {error}
        </span>
      )}
    </span>
  );
}
