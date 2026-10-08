## Context

The name appears in three kinds of places:

1. **What people see:** the hero title (`src/ui/app.tsx`), the page `<title>` (`scripts/build-ui.ts`), the tour's welcome step, Help text, the mark's accessible name, README and docs.
2. **The executable and its distribution:** `dist/openspec-dashboard` (`scripts/build.ts`), the CLI usage and startup lines (`src/server/index.ts`), CI smoke tests, release asset names and the release-notes template (`.github/workflows/release.yml`), and repository URLs (`whatsNew.tsx`, `demo/banner.tsx`, README).
3. **Local identifiers stored on users' machines or in their repositories:**
   - the home `~/.openspec-dashboard/`, which holds `config.json`, `activity.jsonl`, sessions, the console folder, and git worktrees whose absolute paths are registered in each repository's `.git/worktrees/`
   - the `OPENSPEC_DASHBOARD_HOME` variable
   - browser storage keys `openspec-dashboard.*` on `127.0.0.1:4711`
   - the `openspec-dashboard:shared` markers written into tracked repositories' `openspec/config.yaml`
   - the `depends-on.yaml` header comment

The demo is deployed by `pages.yml` to GitHub Pages under the owner's custom domain, so its path is the repository name: `https://blog.wndlng.ch/openspec-dashboard/`.

## Goals / Non-Goals

**Goals:**
- Every surface a person reads says `Spec Control`, with the new tagline.
- The binary and release downloads are called `spec-control`.
- Existing users upgrade by replacing the binary, with nothing to migrate and nothing lost.

**Non-Goals:**
- Renaming the local identifiers in group 3. Moving the home directory means relocating registered git worktrees (`git worktree repair` per repository) and a console folder that may be some agent's working directory. Changing the markers means rewriting tracked repositories' config files. Both deserve their own change with a migration; until then they keep the old names, and docs that show these paths stay accurate.
- A new logo. The mark describes the product's function, not its name, and stays.
- Renaming the OpenSpec capability names in `openspec/specs/` (`kanban-board`, `dashboard-api`, …); they describe functions, not the product.

## Decisions

### One visible name, one executable name
`Spec Control` in prose and titles; `spec-control` for the executable, package, repository and release assets. The hero shows the name and the tagline `Mission control for every agent change across your repositories. Never miss a change.` The README opens with `Spec Control — mission control for every agent change across your repositories. Never miss a change.` and keeps one sentence saying it is a local Kanban board for OpenSpec repositories, so people searching for OpenSpec still find it.

### The binary does not answer to the old name
There is no `openspec-dashboard` alias or symlink. Users download the binary by hand, so the new download is the switch. The release notes of the first renamed release say so, and README's Run section names the file.

### Page title
`Spec Control` for the app and `Spec Control — Demo` for the demo. The browser tab and bookmarks change once; the origin (`127.0.0.1:4711`) does not, so stored preferences survive.

### Repository rename and the demo URL
The repository becomes `jwndlng/spec-control`. GitHub redirects git remotes, issues, pull requests and release download URLs from the old name, but **not** GitHub Pages project sites, so the demo moves to `https://blog.wndlng.ch/spec-control/` and the old path would 404. The owner's user site (the repository behind `blog.wndlng.ch`) gets an `openspec-dashboard/index.html` that redirects to the new path, with a `<meta http-equiv="refresh">` that keeps the hash so deep links like `#/board` survive, and a canonical link. No repository may be created under the old name, since that would break GitHub's redirects.
- Order: merge the code change (links already point to the new URLs), rename the repository, let `pages.yml` redeploy, then add the redirect page on the user site.
- *Alternative:* keep the repository name and only rebrand. Rejected: the repository name is what people type, star and see in release URLs; a mismatch would keep the old name alive.

### Attestations of earlier releases
Build-provenance attestations name the repository they were built in. After the rename, `gh attestation verify --repo jwndlng/spec-control` is the documented command for new releases. For releases built before the rename, the README keeps one line saying to use `--repo jwndlng/openspec-dashboard`. Task 5.3 checks whether the old name still verifies after the rename; if it does, that line is dropped.

### What's new
One entry, `2026-10-07-spec-control`, titled `OpenSpec Dashboard is now Spec Control`. It explains that the binary and downloads are now `spec-control` and that settings, sessions and worktrees carry over untouched.

## Risks / Trade-offs

- **Two names in the codebase until the follow-up:** `~/.openspec-dashboard/` and `OPENSPEC_DASHBOARD_*` keep the old name. Mitigation: CLAUDE.md states that these are deliberately unchanged, and why, so agents do not "fix" them piecemeal.
- **Bookmarks and links to the demo break** if the redirect page is forgotten. Mitigation: it is an explicit task, verified with a deep link.
- **Scripts that call `openspec-dashboard`** (users' own launchers) stop working after downloading the new binary. Mitigation: called out in the release notes.
- **Search visibility**: the new name drops "OpenSpec". Mitigation: the README description and the GitHub repository description and topics keep `openspec`.

## Migration Plan

1. Merge this change; the next release ships `spec-control-<tag>-<platform>` assets.
2. Rename the GitHub repository; update its description and topics; confirm git, release and issue redirects.
3. Confirm `pages.yml` deploys the demo at `/spec-control/`; add the redirect page on the user site.
4. Publish the release with a note about the new binary name.

Rollback: revert the commit and rename the repository back; nothing on users' machines changed.
