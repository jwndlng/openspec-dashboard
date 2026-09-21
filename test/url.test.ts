import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, httpApi, setApi, type Api } from "../src/ui/api.ts";
import { backTarget, boardFrom, changePath, parseDetailQuery, routeFromPath, serializeDetailQuery } from "../src/ui/routes.ts";
import { href, navigateUrl, pathFromLocation, replaceQueryUrl } from "../src/ui/url.ts";

test("path mode reads the route from the pathname and produces today's URLs", () => {
  expect(pathFromLocation({ pathname: "/board", hash: "" }, "path")).toBe("/board");
  expect(href("/repo/abc", "path")).toBe("/repo/abc");
  expect(navigateUrl({ pathname: "/board" }, "/settings", "path")).toBe("/settings");
  expect(replaceQueryUrl({ pathname: "/board", hash: "" }, "?q=x")).toBe("/board?q=x");
});

test("hash mode reads the route from the fragment, wherever the page is served from", () => {
  const at = (hash: string) => pathFromLocation({ pathname: "/openspec-dashboard/index.html", hash }, "hash");
  expect(at("#/board")).toBe("/board");
  expect(routeFromPath(at("#/repo/a%2Fb"))).toEqual({ view: "repo", repoId: "a/b" });
  expect(routeFromPath(at("#/settings"))).toEqual({ view: "settings" });
  expect(at("")).toBe("/");
  expect(at("#top")).toBe("/");
});

test("hash mode navigates within the current document and links open the same view in a new tab", () => {
  expect(navigateUrl({ pathname: "/openspec-dashboard/" }, "/board", "hash")).toBe("/openspec-dashboard/#/board");
  expect(navigateUrl({ pathname: "/tmp/demo/index.html" }, "/", "hash")).toBe("/tmp/demo/index.html#/");
  expect(href("/board", "hash")).toBe("#/board");
});

test("replacing the query keeps the fragment, which is the route in hash mode", () => {
  expect(replaceQueryUrl({ pathname: "/demo/index.html", hash: "#/repo/x" }, "?archived=0")).toBe("/demo/index.html?archived=0#/repo/x");
  expect(replaceQueryUrl({ pathname: "/demo/index.html", hash: "#/board" }, "")).toBe("/demo/index.html#/board");
});

test("only url.ts touches location and history", () => {
  const ui = join(import.meta.dir, "..", "src", "ui");
  const offenders = (readdirSync(ui, { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && f !== "url.ts")
    .filter((f) => /\b(location|history)\.[a-zA-Z]/.test(readFileSync(join(ui, f), "utf8")));
  expect(offenders).toEqual([]);
});

test("api forwards to HTTP by default and to whatever the entry point sets", async () => {
  const calls: string[] = [];
  const fake: Api = {
    ...httpApi,
    state: async () => {
      calls.push("state");
      return { generatedAt: "2026-01-01T00:00:00.000Z", repos: [] };
    },
  };
  try {
    setApi(fake);
    expect((await api.state()).repos).toEqual([]);
    expect(calls).toEqual(["state"]);
  } finally {
    setApi(httpApi);
  }
});

test("change detail route: round trip, encoded names, undecodable paths, repo route unaffected", () => {
  expect(changePath("abc", "cloud-deployment")).toBe("/repo/abc/change/cloud-deployment");
  expect(routeFromPath(changePath("abc", "cloud-deployment"))).toEqual({ view: "change", repoId: "abc", changeName: "cloud-deployment" });
  expect(routeFromPath(changePath("a/b", "v1.2_x y"))).toEqual({ view: "change", repoId: "a/b", changeName: "v1.2_x y" });
  expect(routeFromPath("/repo/abc/change/cloud-deployment/")).toEqual({ view: "change", repoId: "abc", changeName: "cloud-deployment" });
  expect(routeFromPath("/repo/abc/change/%E0%A4%A")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/%E0%A4%A/change/x")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/abc/change")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/abc/change/x/extra")).toEqual({ view: "overview" });
  expect(routeFromPath("/repo/abc")).toEqual({ view: "repo", repoId: "abc" });
  const at = (hash: string) => pathFromLocation({ pathname: "/demo/index.html", hash }, "hash");
  expect(routeFromPath(at("#/repo/abc/change/cloud-deployment"))).toEqual({ view: "change", repoId: "abc", changeName: "cloud-deployment" });
});

test("a link with a query works in both routing modes", () => {
  expect(href("/repo/a/change/x", "path", "?from=%2Fboard")).toBe("/repo/a/change/x?from=%2Fboard");
  expect(href("/repo/a/change/x", "hash", "?from=%2Fboard")).toBe("?from=%2Fboard#/repo/a/change/x");
  expect(navigateUrl({ pathname: "/demo/index.html" }, "/board", "hash", "?q=sync")).toBe("/demo/index.html?q=sync#/board");
  expect(navigateUrl({ pathname: "/x" }, "/board", "path", "?q=sync")).toBe("/board?q=sync");
});

test("detail query: artifact, file, raw and from round-trip", () => {
  const q = { artifact: "specs", file: "specs/kanban-board/spec.md", raw: true, from: "/board?q=sync&archived=0" };
  expect(parseDetailQuery(serializeDetailQuery(q))).toEqual(q);
  expect(serializeDetailQuery({ raw: false })).toBe("");
  expect(parseDetailQuery("")).toEqual({ artifact: undefined, file: undefined, raw: false, from: undefined });
  expect(parseDetailQuery("?raw=yes").raw).toBe(false);
});

test("the back link follows `from` only when it is a board of this app", () => {
  expect(backTarget(boardFrom("/board", "?q=sync"), "r1")).toEqual({ path: "/board", query: "?q=sync" });
  expect(backTarget("/repo/r2?archived=0", "r1")).toEqual({ path: "/repo/r2", query: "?archived=0" });
  expect(backTarget("/board", "r1")).toEqual({ path: "/board", query: "" });
  const fallback = { path: "/repo/r1", query: "" };
  for (const foreign of [undefined, "", "https://example.com/board", "//example.com/board", "javascript:alert(1)", "/settings", "/", "/repo/r1/change/x", "board", "/board#x", "/\\example.com"]) {
    expect([foreign, backTarget(foreign, "r1")]).toEqual([foreign, fallback]);
  }
});
