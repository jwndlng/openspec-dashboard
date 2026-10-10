// Adding GitHub repositories (openspec/specs/github-repositories): what a typed repository may be, reduced to
// `owner/name`, and the folder it is cloned into by default. Shared, so the dialog refuses instantly and the server
// re-checks every request with the very same rules — and builds the clone URL itself, never taking one from a request.
import { isProjectName } from "./types.ts";

/** Letters, digits and single hyphens, neither first nor last, at most 39 characters: GitHub's own rule for a login. */
const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;
const NAME = /^[A-Za-z0-9._-]{1,100}$/;

export type GithubRepoParse = { ok: true; repo: string; owner: string; name: string } | { ok: false; reason: string };

export function isGithubOwner(value: unknown): value is string {
  return typeof value === "string" && OWNER.test(value);
}

function isRepoName(name: string): boolean {
  return NAME.test(name) && name !== "." && name !== ".." && !name.toLowerCase().endsWith(".git");
}

const NOT_GITHUB = "not a GitHub repository — type owner/name or a https://github.com/owner/name URL";

/** `owner` and `name` as split from the input, a single trailing `.git` dropped, then validated. */
function validated(owner: string, rawName: string): GithubRepoParse {
  const name = rawName.toLowerCase().endsWith(".git") ? rawName.slice(0, -4) : rawName;
  if (!isGithubOwner(owner)) return { ok: false, reason: "the owner may only use letters, digits and single hyphens (at most 39 characters)" };
  if (!isRepoName(name)) return { ok: false, reason: "the repository name may only use letters, digits, '.', '_' and '-' (at most 100 characters)" };
  return { ok: true, repo: `${owner}/${name}`, owner, name };
}

/**
 * A typed repository reduced to `owner/name`: `owner/name`, `https://github.com/owner/name` with or without a trailing
 * `.git` or `/`, or `git@github.com:owner/name.git`. Anything else — another host or scheme, a longer path, a query, a
 * fragment, credentials — is refused, and no reason ever repeats what was typed, so a secret never reaches the page.
 */
export function parseGithubRepo(input: unknown): GithubRepoParse {
  const text = typeof input === "string" ? input.trim() : "";
  if (!text) return { ok: false, reason: "type a repository as owner/name" };
  const ssh = /^git@([^:/]+):([^/]+)\/([^/]+)$/.exec(text);
  if (ssh) return ssh[1].toLowerCase() === "github.com" ? validated(ssh[2], ssh[3]) : { ok: false, reason: NOT_GITHUB };
  if (text.includes("://")) {
    // Parsed by hand, not with `URL`: `URL` would quietly resolve `..` segments and hide what was typed.
    const url = /^([A-Za-z][A-Za-z0-9+.-]*):\/\/([^/?#]*)([^?#]*)(.*)$/.exec(text);
    if (!url) return { ok: false, reason: NOT_GITHUB };
    const [, scheme, authority, path, rest] = url;
    if (scheme.toLowerCase() !== "https") return { ok: false, reason: NOT_GITHUB };
    if (authority.includes("@")) return { ok: false, reason: "a URL with credentials in it is not accepted — type owner/name" };
    if (authority.toLowerCase() !== "github.com") return { ok: false, reason: NOT_GITHUB };
    if (rest !== "") return { ok: false, reason: "a URL with a query or a fragment is not a repository — type owner/name" };
    const segments = path.replace(/\/$/, "").split("/").slice(1);
    if (segments.length !== 2 || segments.some((s) => s === "")) return { ok: false, reason: "that URL names more than a repository — type owner/name" };
    return validated(segments[0], segments[1]);
  }
  if (/[?#@:\\]/.test(text)) return { ok: false, reason: NOT_GITHUB };
  const parts = text.split("/");
  if (parts.length !== 2 || parts.some((p) => p === "")) return { ok: false, reason: parts.length > 2 ? "a repository is owner/name, nothing more" : "type a repository as owner/name" };
  return validated(parts[0], parts[1]);
}

/** The one URL a clone is ever made from, built from a validated `owner/name`. */
export function githubCloneUrl(repo: string): string {
  return `https://github.com/${repo}.git`;
}

/**
 * The folder a repository is cloned into unless the user names another: the repository's name, or — for a name a
 * folder may not have, such as `.github` — that name without its leading punctuation.
 */
export function defaultCloneFolder(repo: string): string {
  const name = repo.slice(repo.indexOf("/") + 1);
  if (isProjectName(name)) return name;
  const trimmed = name.replace(/^[^A-Za-z0-9]+/, "").replace(/\.git$/i, "");
  return isProjectName(trimmed) ? trimmed : "repository";
}
