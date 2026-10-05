// What's new: the user-visible features, written for the people running the dashboard — what they can now do and
// where. Compiled into the UI, so the binary and the demo show it without a request. Newest first; one entry per
// feature, added by the pull request that ships it (CONTRIBUTING.md, "What's new"). Entries are history: they describe
// the feature as it shipped and are not rewritten when it changes later.

export interface ChangelogEntry {
  /** `<date>-<kebab-case-slug>`; never changed once released, since browsers remember which ids they have seen. */
  id: string;
  /** Calendar date the feature was merged, `YYYY-MM-DD`. */
  date: string;
  title: string;
  /** One or two sentences of Markdown. */
  summary: string;
}

export const CHANGELOG: readonly ChangelogEntry[] = [
  {
    id: "2026-10-05-antigravity-console",
    date: "2026-10-05",
    title: "Antigravity consoles open, and fresh projects say what they need",
    summary:
      "With the **Antigravity** preset, the main console and a project's console now start `agy` instead of failing on a dangling `-i`; a saved preset is fixed on its own. Starting a change session in a project without a first commit now says so instead of showing git's `invalid reference: HEAD`.",
  },
  {
    id: "2026-10-05-pr-title-convention",
    date: "2026-10-05",
    title: "Pull request title convention per project",
    summary:
      "Pick **Conventional Commits** under **PR titles** for a project on the **Projects** overview, and **Ship** asks the agent to title that project's pull requests and commits that way. Without it, Ship no longer asks for Conventional Commits and the agent follows the repository's own conventions.",
  },
  {
    id: "2026-10-05-change-dependencies",
    date: "2026-10-05",
    title: "Changes that wait for other changes",
    summary:
      "Pick what a new change **Depends on** in the **New change** form, or list it in the change's `depends-on.yaml`. Until those changes are done or archived on your main checkout, the card shows `waits for …` instead of **Implement**, and the details view lists both directions.",
  },
  {
    id: "2026-10-05-docs-auto-merge",
    date: "2026-10-05",
    title: "Auto-merge docs-only pull requests",
    summary:
      "Switch on **Docs auto-merge** for a project on the **Projects** overview, and **Ship** asks your agent to enable auto-merge on a pull request that only changes files under `openspec/`, such as an archive. Every other pull request still waits for review.",
  },
  {
    id: "2026-10-03-whats-new",
    date: "2026-10-03",
    title: "What's new",
    summary:
      "The **What's new** button in the top corner lists the features added to the dashboard, newest first, and counts the ones you have not seen yet. It works offline: the list is part of the dashboard itself.",
  },
  {
    id: "2026-10-02-project-settings-on-overview",
    date: "2026-10-02",
    title: "Project settings on the overview",
    summary:
      "Each project on the **Projects** overview carries its own settings, saved at once: switch agent sessions on or off, pick its agent, rename it in place and edit its labels. Unmanaged projects offer **Forget**.",
  },
  {
    id: "2026-10-02-archived-cards-keep-their-session",
    date: "2026-10-02",
    title: "Archived cards stay while their session runs",
    summary:
      "With **Hide merged** on, an archived change whose agent session is still running keeps its card in the Archived column, so the way back to that console does not disappear.",
  },
  {
    id: "2026-10-02-project-labels",
    date: "2026-10-02",
    title: "Project labels",
    summary:
      "Give repositories your own labels, and see technology labels detected from the files in each project. Labels show on the overview and the board header, and filter the overview.",
  },
  {
    id: "2026-10-01-integrate-with-any-agent",
    date: "2026-10-01",
    title: "Integrate works with every agent",
    summary:
      "**Integrate** and **New project** no longer need an integrate prompt in the agent's profile: every agent gets a default prompt that sets up OpenSpec in the repository.",
  },
  {
    id: "2026-10-01-start-sessions-from-the-board",
    date: "2026-10-01",
    title: "Start sessions without leaving the board",
    summary:
      "Starting an agent from a card keeps you on the board. The card's session badge takes the starter's place and opens the **Console** tab when you want it.",
  },
  {
    id: "2026-10-01-manage-repositories-from-overview",
    date: "2026-10-01",
    title: "Manage repositories from the overview",
    summary:
      "The **Projects** overview lists disabled, discovered and not-yet-OpenSpec repositories under *Untracked & disabled*, with **Enable**, **Ignore** and **Integrate**; every tracked project can be disabled from its row or tile.",
  },
  {
    id: "2026-10-01-activity-keeps-seven-days",
    date: "2026-10-01",
    title: "Activity keeps the last 7 days",
    summary: "The **Activity** feed keeps a week of history and says so at its end; older events are dropped from the log.",
  },
  {
    id: "2026-10-01-new-project",
    date: "2026-10-01",
    title: "Create a new project",
    summary:
      "**New project** on the overview creates an empty folder in one of your workspace roots, initialises git in it and starts an agent that sets up OpenSpec there.",
  },
  {
    id: "2026-10-01-pull-request-on-cards",
    date: "2026-10-01",
    title: "Pull requests on cards",
    summary:
      "A card shows its change's pull request — `PR #<n>` with its state — and the detail header shows its title, review and checks, linking to GitHub.",
  },
  {
    id: "2026-09-30-pull-requests-view",
    date: "2026-09-30",
    title: "Pull requests",
    summary:
      "The **Pull requests** view lists the open pull requests of your GitHub repositories, read through the GitHub CLI (`gh`) when you open it or press **Refresh**. The overview counts them per project.",
  },
];
