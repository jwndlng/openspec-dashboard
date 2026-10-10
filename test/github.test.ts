import { expect, test } from "bun:test";
import { defaultCloneFolder, githubCloneUrl, isGithubOwner, parseGithubRepo } from "../src/shared/github.ts";

const repoOf = (input: string) => {
  const parsed = parseGithubRepo(input);
  return parsed.ok ? parsed.repo : undefined;
};
const reasonOf = (input: unknown) => {
  const parsed = parseGithubRepo(input);
  return parsed.ok ? undefined : parsed.reason;
};

test("every accepted form reduces to owner/name with the repository's name as the folder", () => {
  for (const input of [
    "acme/beta-soc",
    "  acme/beta-soc  ",
    "https://github.com/acme/beta-soc",
    "https://github.com/acme/beta-soc/",
    "https://github.com/acme/beta-soc.git",
    "https://GitHub.com/acme/beta-soc.git/",
    "git@github.com:acme/beta-soc.git",
    "git@github.com:acme/beta-soc",
  ]) {
    expect(repoOf(input)).toBe("acme/beta-soc");
  }
  expect(defaultCloneFolder("acme/beta-soc")).toBe("beta-soc");
  expect(githubCloneUrl("acme/beta-soc")).toBe("https://github.com/acme/beta-soc.git");
});

test("names GitHub allows are kept as they are", () => {
  expect(repoOf("jdoe/alpha.infra_2")).toBe("jdoe/alpha.infra_2");
  expect(repoOf("a-b-c/x")).toBe("a-b-c/x");
});

test("another host or scheme is refused as not a GitHub repository", () => {
  for (const input of ["https://gitlab.com/acme/beta-soc", "http://github.com/acme/beta-soc", "ssh://git@github.com/acme/beta-soc.git", "git@gitlab.com:acme/beta-soc.git", "https://github.com:8443/acme/beta-soc", "https://example.test/acme/beta-soc"]) {
    expect(reasonOf(input)).toContain("not a GitHub repository");
  }
});

test("a longer path, a query or a fragment is refused", () => {
  expect(reasonOf("https://github.com/acme/beta-soc/tree/main")).toContain("more than a repository");
  expect(reasonOf("https://github.com/acme/../../etc")).toBeDefined();
  expect(reasonOf("acme/../../etc")).toBeDefined();
  expect(reasonOf("acme/beta-soc/extra")).toContain("nothing more");
  expect(reasonOf("https://github.com/acme/beta-soc?tab=readme")).toContain("query");
  expect(reasonOf("https://github.com/acme/beta-soc#readme")).toContain("fragment");
});

test("credentials are refused and never repeated", () => {
  const reason = reasonOf("https://user:secret@github.com/acme/beta-soc");
  expect(reason).toContain("credentials");
  expect(reason).not.toContain("secret");
  expect(reason).not.toContain("user");
  expect(reasonOf("https://ghp_abc123@github.com/acme/beta-soc")).not.toContain("ghp_abc123");
});

test("owner and name are validated", () => {
  for (const input of ["-acme/x", "acme-/x", "ac--me/x", `${"a".repeat(40)}/x`, "ac_me/x", "acme/.", "acme/..", `acme/${"n".repeat(101)}`, "acme/be ta", "acme/x.git.git", "acme/", "/x", "acme", "", "acme\\x"]) {
    expect(repoOf(input)).toBeUndefined();
  }
  expect(reasonOf(42)).toBeDefined();
  expect(isGithubOwner("jdoe")).toBe(true);
  expect(isGithubOwner("j-doe-2")).toBe(true);
  expect(isGithubOwner("-jdoe")).toBe(false);
  expect(isGithubOwner("jdoe/x")).toBe(false);
  expect(isGithubOwner(undefined)).toBe(false);
});

test("a name a folder may not have gets a folder name that is one", () => {
  expect(defaultCloneFolder("acme/.github")).toBe("github");
  expect(defaultCloneFolder("acme/_private")).toBe("private");
  expect(defaultCloneFolder("acme/---")).toBe("repository");
});
