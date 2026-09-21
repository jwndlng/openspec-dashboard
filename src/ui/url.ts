// All reads and writes of the browser URL go through here, so the UI works in two routing modes:
// "path" (the dashboard server owns the site root: /board, /repo/<id>) and "hash" (static hosting, a sub-path
// or file://: index.html#/board). The query string carries filter state in both modes.
// Free of DOM access at import time so the pure parts can be unit-tested.

export type RoutingMode = "path" | "hash";

let mode: RoutingMode = "path";

export function setRoutingMode(next: RoutingMode): void {
  mode = next;
}

interface LocationParts {
  pathname: string;
  search: string;
  hash: string;
}

/** The app route ("/board") for a browser location. In hash mode an empty or foreign fragment is the root. */
export function pathFromLocation(loc: Pick<LocationParts, "pathname" | "hash">, routing: RoutingMode = mode): string {
  if (routing === "path") return loc.pathname;
  return loc.hash.startsWith("#/") ? loc.hash.slice(1) : "/";
}

/** What a link to an app route puts in `href`, so opening it in a new tab lands on the same view. */
export function href(path: string, routing: RoutingMode = mode, query = ""): string {
  return routing === "hash" ? `${query}#${path}` : `${path}${query}`;
}

/**
 * The URL to push when navigating to an app route. Like a plain link, it starts the new view without a query unless
 * one is given (`query` is "" or starts with "?"); in hash mode the query stays in front of the fragment, where
 * `currentQuery` reads it.
 */
export function navigateUrl(loc: Pick<LocationParts, "pathname">, path: string, routing: RoutingMode = mode, query = ""): string {
  return routing === "hash" ? `${loc.pathname}${query}#${path}` : `${path}${query}`;
}

/** The URL to replace when only the query changes; keeps the fragment, which is the route in hash mode. */
export function replaceQueryUrl(loc: Pick<LocationParts, "pathname" | "hash">, query: string): string {
  return `${loc.pathname}${query}${loc.hash}`;
}

export function currentPath(): string {
  return pathFromLocation(location);
}

export function currentQuery(): string {
  return location.search;
}

export function navigate(path: string, query = ""): void {
  history.pushState(null, "", navigateUrl(location, path, mode, query));
  dispatchEvent(new PopStateEvent("popstate"));
}

/**
 * For the `onClick` of an anchor to an app route: a plain click navigates in place, anything else (⌘/ctrl/shift-click,
 * middle click) is left to the browser so the `href` opens in a new tab or window.
 */
export function followInApp(event: MouseEvent, path: string, query = ""): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(path, query);
}

/** `query` is "" or starts with "?". */
export function replaceQuery(query: string): void {
  history.replaceState(null, "", replaceQueryUrl(location, query));
}

/** Calls back on in-app navigation, back/forward and manual fragment edits. Returns the unsubscribe function. */
export function onRouteChange(listener: () => void): () => void {
  addEventListener("popstate", listener);
  addEventListener("hashchange", listener);
  return () => {
    removeEventListener("popstate", listener);
    removeEventListener("hashchange", listener);
  };
}
