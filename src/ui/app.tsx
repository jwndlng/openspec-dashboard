import { useCallback, useEffect, useLayoutEffect, useState } from "preact/hooks";
import type { ComponentChildren } from "preact";
import type { Config, Snapshot } from "../shared/types.ts";
import { Activity } from "./activity.tsx";
import { loadSeen, saveSeen, unseenLabel } from "./activityState.ts";
import { api } from "./api.ts";
import { ChangeDetail } from "./changeDetail.tsx";
import { ConsoleButton, ConsoleOverlay } from "./console.tsx";
import { relTime } from "./format.ts";
import { Kanban } from "./kanban.tsx";
import { Overview } from "./overview.tsx";
import { PullProvider } from "./pull.tsx";
import { enabledOnly } from "./overviewState.ts";
import { backTarget, parseDetailQuery, repoPath, type Route, routeFromPath } from "./routes.ts";
import { EndSessionDialog } from "./endSessionDialog.tsx";
import { OpenWork, SessionProvider } from "./sessions.tsx";
import { Settings } from "./settings.tsx";
import { currentPath, currentQuery, href, navigate, onRouteChange } from "./url.ts";
import { applyTheme, loadPreference, nextPreference, resolveTheme, savePreference, type ThemePreference } from "./theme.ts";
import { IconActivity, IconKanban, IconLayoutGrid, IconMonitor, IconMoon, IconRefresh, IconSettings, IconSun } from "./icons.tsx";
import { LogoMark } from "./logo.tsx";

const THEME_LABEL: Record<ThemePreference, string> = { system: "System", light: "Light", dark: "Dark" };
const THEME_ICON: Record<ThemePreference, typeof IconSun> = { system: IconMonitor, light: IconSun, dark: IconMoon };

export function App() {
  const [route, setRoute] = useState<Route>(() => routeFromPath(currentPath()));
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [config, setConfig] = useState<Config | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [, tick] = useState(0);
  const [themePref, setThemePref] = useState<ThemePreference>(loadPreference);
  const [unseen, setUnseen] = useState(0);
  // The main console overlay. Not in the route: opening and closing it leaves the page (and its filters) as it was.
  const [consoleOpen, showConsole] = useState(false);

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

  // The board on screen: the route's own, or — for a change — the board its detail overlay belongs to, which is also
  // where closing the overlay goes. The detail view keeps `from` in the query, so this stays put while it is open.
  const back = route.view === "change" ? backTarget(parseDetailQuery(currentQuery()).from, route.repoId) : undefined;
  const boardRoute: Route = back ? routeFromPath(back.path) : route;
  // The overlay closes with the feature: nothing may be started while agent sessions are off.
  const consoleShown = consoleOpen && config?.agentSessions.enabled === true;
  const overlayOpen = route.view === "change" || consoleShown;

  const ThemeIcon = THEME_ICON[themePref];
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
    {/* Above both the page and the overlay: the detail view's Console tab reads sessions from here too, and the
        end-session dialog it opens must not sit inside the part that goes inert. */}
    <SessionProvider config={config} snapshot={shown} consoleOpen={consoleShown} showConsole={showConsole}>
    {/* Everything but the detail overlay: inert while it is open, so the board behind it takes no focus and no clicks. */}
    <div class="app" inert={overlayOpen} aria-hidden={overlayOpen ? "true" : undefined}>
      {/* The hero: the product's name, big, over a soft accent glow; below it the navigation, and — continuing the same
          ground — the current view's own header band and filter bar. The status and actions keep their corner. */}
      <header class="topbar hero">
        <div class="hero-brand">
          <LogoMark size={60} />
          <div class="hero-copy">
            <h1 class="hero-title">
              OpenSpec <span class="hero-accent">Dashboard</span>
            </h1>
            <p class="hero-tagline">Central management for OpenSpec across all your repositories — never miss a change.</p>
          </div>
          {/* Status and actions: the hero's top corner. */}
          <div class="topbar-end">
            <OpenWork />
            {failing.map((r) => (
              <span class="badge danger" title={r.error}>
                ⚠ {r.name}
              </span>
            ))}
            {error && <span class="badge danger">API: {error}</span>}
            <ConsoleButton />
            <button type="button" class="btn sm ghost" onClick={cycleTheme} title="Cycle theme: System → Light → Dark">
              <ThemeIcon />
              Theme: {THEME_LABEL[themePref]}
            </button>
            <span class="status">
              <span>updated {snapshot ? relTime(snapshot.generatedAt) : "…"}</span>
              <button type="button" class="btn sm" onClick={refresh} disabled={refreshing}>
                <IconRefresh size={13} />
                {refreshing ? "Scanning…" : "Refresh"}
              </button>
            </span>
          </div>
        </div>
        <nav aria-label="Main">
          {link(
            "/",
            <>
              <IconLayoutGrid />
              Projects
            </>,
            route.view === "overview" || boardRoute.view === "repo",
          )}
          {link(
            "/board",
            <>
              <IconKanban />
              All changes
            </>,
            boardRoute.view === "board",
          )}
          {link(
            "/activity",
            <>
              <IconActivity />
              Activity
              {route.view !== "activity" && unseenLabel(unseen) && (
                <span class="nav-count" title={`${unseen} new since you last looked`}>
                  {unseenLabel(unseen)}
                </span>
              )}
            </>,
            route.view === "activity",
          )}
          {link(
            "/settings",
            <>
              <IconSettings />
              Settings
            </>,
            route.view === "settings",
          )}
        </nav>
      </header>
      <main class="main">
        {route.view === "settings" ? (
          <Settings config={config} snapshot={shown} onSaved={(c) => { setConfig(c); void loadState(); }} onRescan={reloadSoon} />
        ) : route.view === "activity" ? (
          <Activity snapshot={shown} onSeen={markSeen} />
        ) : route.view === "overview" ? (
          <Overview snapshot={shown} config={config} />
        ) : (
          // One board for the board, repository and change routes, keyed by its path: opening and closing a change keeps
          // this very instance — its filters, minimized groups and scroll position — while moving between boards starts
          // a new one that reads its filters again.
          <Kanban
            key={boardRoute.view === "repo" ? repoPath(boardRoute.repoId) : "/board"}
            snapshot={shown}
            config={config}
            repoId={boardRoute.view === "repo" ? boardRoute.repoId : undefined}
            query={back?.query}
            onReload={reloadSoon}
          />
        )}
      </main>
    </div>
    {/* Outside the inert part: it is opened from the detail overlay's Console tab as well as from a card. */}
    <EndSessionDialog />
    {route.view === "change" && (
      // Keyed so selection and content start over when moving between changes.
      <ChangeDetail key={`${route.repoId}/${route.changeName}`} snapshot={shown} repoId={route.repoId} changeName={route.changeName} />
    )}
    <ConsoleOverlay />
    </SessionProvider>
    </PullProvider>
  );
}
