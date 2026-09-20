import { expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, httpApi, setApi, type Api } from "../src/ui/api.ts";
import { routeFromPath } from "../src/ui/routes.ts";
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
