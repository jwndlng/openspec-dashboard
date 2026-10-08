import { expect, test } from "bun:test";
import { eventUrl, externalTarget, navigationRules } from "../../desktop/src/logic/links.ts";

test("the server's own origin stays in the window", () => {
  expect(externalTarget("http://127.0.0.1:4711/", 4711)).toEqual({ kind: "internal" });
  expect(externalTarget("http://127.0.0.1:4711/repos/demo-ops?x=1#y", 4711)).toEqual({ kind: "internal" });
});

test("another loopback port or host name is another origin and goes to the browser", () => {
  expect(externalTarget("http://127.0.0.1:4712/", 4711)).toEqual({ kind: "external", url: "http://127.0.0.1:4712/" });
  expect(externalTarget("http://localhost:4711/", 4711)).toEqual({ kind: "external", url: "http://localhost:4711/" });
});

test("web and mail links go to the default browser", () => {
  expect(externalTarget("https://github.com/acme/demo-ops/pull/7", 4711)).toEqual({ kind: "external", url: "https://github.com/acme/demo-ops/pull/7" });
  expect(externalTarget("mailto:someone@example.com", 4711)).toEqual({ kind: "external", url: "mailto:someone@example.com" });
});

test("file, script, custom schemes and garbage are dropped", () => {
  for (const url of ["file:///etc/passwd", "javascript:alert(1)", "vscode://file/w/acme", "x-apple.systempreferences:", "data:text/html,hi", "not a url", ""]) {
    expect(externalTarget(url, 4711)).toEqual({ kind: "drop" });
  }
});

test("the navigation rules block everything but the server's origin, last match winning", () => {
  expect(navigationRules(4711)).toEqual(["^*", "http://127.0.0.1:4711/*"]);
});

test("an event's URL is found in the shapes Electrobun sends", () => {
  expect(eventUrl("https://github.com/")).toBe("https://github.com/");
  expect(eventUrl({ url: "https://github.com/", allowed: false })).toBe("https://github.com/");
  expect(eventUrl({ detail: JSON.stringify({ url: "https://github.com/", isCmdClick: false }) })).toBe("https://github.com/");
  expect(eventUrl({ detail: "https://github.com/" })).toBe("https://github.com/");
  expect(eventUrl(undefined)).toBeUndefined();
  expect(eventUrl({ other: 1 })).toBeUndefined();
});
