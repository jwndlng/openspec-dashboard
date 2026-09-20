// Client-side routes. Kept free of DOM access at import time so it can be unit-tested.
export type Route = { view: "overview" } | { view: "board" } | { view: "repo"; repoId: string } | { view: "settings" };

export function routeFromPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "");
  if (path === "/settings") return { view: "settings" };
  if (path === "/board") return { view: "board" };
  const repo = /^\/repo\/([^/]+)$/.exec(path);
  if (repo) {
    try {
      return { view: "repo", repoId: decodeURIComponent(repo[1]) };
    } catch {
      return { view: "overview" };
    }
  }
  return { view: "overview" };
}

export function repoPath(repoId: string): string {
  return `/repo/${encodeURIComponent(repoId)}`;
}
