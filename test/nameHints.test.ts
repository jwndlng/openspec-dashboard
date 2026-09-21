import { expect, test } from "bun:test";
import { availableName, nameHints } from "../src/shared/nameHints.ts";

const entry = (path: string, name = path.split("/").pop() ?? path) => ({ id: path, name, path });

test("same-named repositories get the distinguishing part of their parent path", () => {
  const hints = nameHints([entry("/w/acme/chat-groups"), entry("/w/ops/repo-mirror/repos/chat-groups"), entry("/w/acme/pkg-tools")]);
  expect(hints.get("/w/acme/chat-groups")).toBe("acme");
  expect(hints.get("/w/ops/repo-mirror/repos/chat-groups")).toBe("ops/repo-mirror/repos");
  expect(hints.has("/w/acme/pkg-tools")).toBe(false); // unique name: no hint
});

test("names are grouped ignoring case, and by display name rather than directory", () => {
  const hints = nameHints([entry("/w/acme/app", "Beta SOC"), entry("/w/ops/service", "beta soc"), entry("/w/ops/app")]);
  expect([...hints]).toEqual([
    ["/w/acme/app", "acme"],
    ["/w/ops/service", "ops"],
  ]);
});

test("an entry directly in the common directory is hinted with that directory's name", () => {
  const hints = nameHints([entry("/w/app"), entry("/w/mirror/app"), entry("/w/mirror/deep/app")]);
  expect([...hints.values()]).toEqual(["w", "mirror", "mirror/deep"]);
});

test("no entries, no hints", () => {
  expect(nameHints([]).size).toBe(0);
  expect(nameHints([entry("/w/a"), entry("/w/b")]).size).toBe(0);
});

test("a colliding default name gets the parent directory appended", () => {
  const candidate = entry("/w/ops/repo-mirror/repos/pkg-tools");
  expect(availableName(candidate, ["pkg-tools"])).toBe("pkg-tools (repos)");
  expect(availableName(candidate, ["PKG-Tools "])).toBe("pkg-tools (repos)");
  expect(availableName(candidate, ["other"])).toBe("pkg-tools");
  expect(availableName(entry("/pkg-tools"), ["pkg-tools"])).toBe("pkg-tools");
});
