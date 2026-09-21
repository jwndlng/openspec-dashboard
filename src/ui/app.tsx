import { useCallback, useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Config, Snapshot } from "../shared/types.ts";
import { Activity } from "./activity.tsx";
import { loadSeen, saveSeen, unseenLabel } from "./activityState.ts";
import { api } from "./api.ts";
import { relTime } from "./format.ts";
import { Kanban } from "./kanban.tsx";
import { Overview } from "./overview.tsx";
import { PullProvider } from "./pull.tsx";
import { enabledOnly } from "./overviewState.ts";
import { type Route, routeFromPath } from "./routes.ts";
import { EndSessionDialog } from "./endSessionDialog.tsx";
import { SessionDock } from "./sessionPanel.tsx";
import { OpenWork, SessionProvider } from "./sessions.tsx";
import { Settings } from "./settings.tsx";
import { currentPath, href, navigate, onRouteChange } from "./url.ts";
import { applyTheme, loadPreference, nextPreference, resolveTheme, savePreference, type ThemePreference } from "./theme.ts";

const THEME_LABEL: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(currentPath()));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, tick] = useState(0);
  const [themePref, setThemePref] = useState<ThemePreference>(loadPreference);
  const [unseen, setUnseen] = useState(0);

  useEffect(() => onRouteChange(() => setRoute(routeFromPath(currentPath()))), []);

  // Apply the theme, and follow live OS appearance changes while the preference is "system".
  // Layout effect so the colours swap in the same frame as the button label.
  useLayoutEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => applyTheme(resolveTheme(themePref, media.matches));
    apply();
    if (themePref !== "system") return;
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [themePref]);

  const cycleTheme = () => {
    const next = nextPreference(themePref);
    savePreference(next);
    setThemePref(next);
  };

  // How many events are newer than the newest one the user saw in the feed. The very first time nothing counts as
  // unseen: whatever exists becomes the baseline. History only — a failure here is not worth a word.
  const loadUnseen = useCallback(async () => {
    try {
      const seen = loadSeen();
      const page = await api.activity({ limit: 1, since: seen ?? "" });
      if (seen === undefined) {
        if (page.newestId) saveSeen(page.newestId);
        setUnseen(0);
      } else setUnseen(page.newerThanSince ?? 0);
    } catch {
      setUnseen(0);
    }
  }, []);

  const markSeen = useCallback((newestId: string | undefined) => {
    if (newestId) saveSeen(newestId);
    setUnseen(0);
  }, []);

  const loadState = useCallback(async () => {
    try {
      setSnapshot(await api.state());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    void loadUnseen();
  }, [loadUnseen]);

  useEffect(() => {
    void loadState();
    api.config().then(setConfig).catch(() => undefined);
  }, [loadState]);

  // Re-fetch on the configured poll interval, and re-render the relative ages every minute.
  useEffect(() => {
    const seconds = Math.max(10, config?.pollIntervalSeconds ?? 60);
    const poll = setInterval(() => void loadState(), seconds * 1000);
    const clock = setInterval(() => tick((n) => n + 1), 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [config?.pollIntervalSeconds, loadState]);

  const refresh = async () => {
    setRefreshing(true);
    const before = snapshot?.generatedAt;
    try {
      await api.scan();
      // Poll until the snapshot changes (or give up after ~20s); a scan usually takes a second or two.
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const next = await api.state();
        if (next.generatedAt !== before) {
          setSnapshot(next);
          break;
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setRefreshing(false);
    }
  };

  // Views only ever see repositories that are enabled right now, even if the last scan predates a Settings change.
  const shown = enabledOnly(snapshot, config);
  const failing = shown?.repos.filter((r) => !r.ok) ?? [];

  // The server rescans after a shared-config save or apply; pick the result up without waiting for the next poll.
  const reloadSoon = () => {
    for (const ms of [1500, 5000]) setTimeout(() => void loadState(), ms);
  };

  const link = (path: string, label: ComponentChildren, active: boolean) => (
    <a
      href={href(path)}
      class={active ? "active" : ""}
      onClick={(e) => {
        e.preventDefault();
        navigate(path);
      }}
    >
      {label}
    </a>
  );

  return (
    <PullProvider onPulled={reloadSoon}>
    <div class="app">
      <SessionProvider config={config} snapshot={shown}>
      <header class="topbar">
        <div class="brand">
          <span class="dot" />
          <h1>OpenSpec Dashboard</h1>
        </div>
        <nav>
          {link("/", "Projects", route.view === "overview" || route.view === "repo")}
          {link("/board", "All changes", route.view === "board")}
          {link(
            "/activity",
            <>
              Activity
              {route.view !== "activity" && unseenLabel(unseen) && (
                <span class="nav-count" title={`${unseen} new since you last looked`}>
                  {unseenLabel(unseen)}
                </span>
              )}
            </>,
            route.view === "activity",
          )}
          {link("/settings", "Settings", route.view === "settings")}
        </nav>
        <div class="spacer" />
        <OpenWork />
        {failing.map((r) => (
          <span class="badge danger" title={r.error}>
            ⚠ {r.name}
          </span>
        ))}
        {error && <span class="badge danger">API: {error}</span>}
        <button type="button" class="btn sm ghost" onClick={cycleTheme} title="Cycle theme: System → Light → Dark">
          Theme: {THEME_LABEL[themePref]}
        </button>
        <span class="status">
          <span>updated {snapshot ? relTime(snapshot.generatedAt) : "…"}</span>
          <button type="button" class="btn sm" onClick={refresh} disabled={refreshing}>
            {refreshing ? "Scanning…" : "Refresh"}
          </button>
        </span>
      </header>
      <main class="main">
        {route.view === "settings" ? (
          <Settings config={config} snapshot={shown} onSaved={(c) => { setConfig(c); void loadState(); }} onRescan={reloadSoon} />
        ) : route.view === "activity" ? (
          <Activity snapshot={shown} onSeen={markSeen} />
        ) : route.view === "overview" ? (
          <Overview snapshot={shown} config={config} />
        ) : (
          // Keyed so filters re-read the URL when moving between boards.
          <Kanban key={route.view === "repo" ? route.repoId : "all"} snapshot={shown} config={config} repoId={route.view === "repo" ? route.repoId : undefined} />
        )}
      </main>
      <SessionDock />
      <EndSessionDialog />
      </SessionProvider>
    </div>
    </PullProvider>
  );
}
