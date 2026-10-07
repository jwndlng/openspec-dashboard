// A managed project's own settings on the projects overview — its agent sessions, its agent, its pull request titles,
// its name and its labels —
// each saved at once through `Tracking` (project-overview: "Each managed project carries its own settings"). Apart from
// Rename, which stays beside the name, they live in the project's settings dialog, opened by the gear on its row or
// tile. Hook-free, so tests can walk them; the state lives in `useTracking`. Every control stops the click, so a row or
// tile that holds one never opens the repository's board because of it.
import type { ComponentChildren } from "preact";
import { CONVENTIONAL_COMMITS_SHIP_SENTENCE, repoAgentEnabled, type Config, type DetectedLabel, type PrTitleConvention, type RepoConfig } from "../shared/types.ts";
import { IconPencil, IconSettings, IconTag } from "./icons.tsx";
import { labelSuggestions, RepoLabelsEditor } from "./labels.tsx";
import { Modal } from "./modal.tsx";
import { DisableButton, type Tracking } from "./untracked.tsx";
import { followInApp, hrefWithQuery } from "./url.ts";

const stop = (e: Event) => e.stopPropagation();

export const SESSIONS_OFF = "Agent sessions are off — turn them on in Settings › Agent sessions";

/**
 * Enabled / Disabled for one project. While agent sessions are off globally it still shows the project's own setting,
 * but as a link to the Agent sessions settings instead of a switch: nothing to toggle until they are on.
 */
export function AgentToggle({ repo, config, tracking }: { repo: RepoConfig; config: Config; tracking: Tracking }) {
  const on = repoAgentEnabled(repo);
  const state = on ? "Enabled" : "Disabled";
  if (!config.agentSessions.enabled) {
    return (
      <a
        class={`control switch-control agent-toggle off-globally ${on ? "on" : ""}`}
        href={hrefWithQuery("/settings", "?section=agents")}
        title={SESSIONS_OFF}
        aria-label={`Agent sessions for ${repo.name}: ${state}. ${SESSIONS_OFF}`}
        onClick={(e) => {
          e.stopPropagation();
          followInApp(e, "/settings", "?section=agents");
        }}
      >
        <span class="switch" aria-hidden="true" />
        {state}
      </a>
    );
  }
  const busy = tracking.busy[repo.id] === "agent";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Agent sessions for ${repo.name}`}
      class={`control switch-control agent-toggle ${on ? "on" : ""}`}
      title={on ? "Agent sessions can be started for this project — switch off, saved at once" : "No agent sessions for this project — switch on, saved at once"}
      disabled={tracking.busy[repo.id] !== undefined}
      onClick={(e) => {
        e.stopPropagation();
        tracking.setAgent(repo.id, { enabled: !on });
      }}
    >
      <span class="switch" aria-hidden="true" />
      {busy ? "Saving…" : state}
    </button>
  );
}

export const AUTO_MERGE_HINT =
  "Auto-merge docs-only pull requests: when everything a session holds is under openspec/, Ship and Archive ask the agent to enable auto-merge on the pull request it opens for it. Any other pull request is left for review. The dashboard itself merges nothing. Once such a pull request has merged, the dashboard ends its session and removes its worktree when that is safe.";

/**
 * On / Off for auto-merging docs-only pull requests (auto-merge-docs). Only where Ship exists: a git project whose agent
 * sessions are enabled. While agent sessions are off globally it shows the setting as a link to Settings, like
 * `AgentToggle`. `short` drops the setting's name from the visible text, for a place that names it already.
 */
export function AutoMergeToggle({ repo, config, isGit, tracking, short = false }: { repo: RepoConfig; config: Config; isGit: boolean; tracking: Tracking; short?: boolean }) {
  if (!isGit || !repoAgentEnabled(repo)) return null;
  const on = repo.agent?.autoMergeDocs === true;
  const state = on ? "On" : "Off";
  // The settings dialog names the setting on its line, so the switch there reads just On or Off.
  const text = short ? state : `Docs auto-merge: ${state}`;
  if (!config.agentSessions.enabled) {
    return (
      <a
        class={`control switch-control agent-toggle auto-merge-toggle off-globally ${on ? "on" : ""}`}
        href={hrefWithQuery("/settings", "?section=agents")}
        title={SESSIONS_OFF}
        aria-label={`Auto-merge docs-only pull requests for ${repo.name}: ${state}. ${SESSIONS_OFF}`}
        onClick={(e) => {
          e.stopPropagation();
          followInApp(e, "/settings", "?section=agents");
        }}
      >
        <span class="switch" aria-hidden="true" />
        {text}
      </a>
    );
  }
  const busy = tracking.busy[repo.id] === "agent";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`Auto-merge docs-only pull requests for ${repo.name}`}
      class={`control switch-control agent-toggle auto-merge-toggle ${on ? "on" : ""}`}
      title={`${AUTO_MERGE_HINT} ${on ? "Switch off" : "Switch on"}, saved at once.`}
      disabled={tracking.busy[repo.id] !== undefined}
      onClick={(e) => {
        e.stopPropagation();
        tracking.setAgent(repo.id, { autoMergeDocs: !on });
      }}
    >
      <span class="switch" aria-hidden="true" />
      {busy ? "Saving…" : text}
    </button>
  );
}

/** Which agent the project's sessions start: only offered with a choice to make and sessions on for the project. */
export function AgentPicker({ repo, config, tracking }: { repo: RepoConfig; config: Config; tracking: Tracking }) {
  const agents = config.agentSessions.agents;
  if (agents.length < 2 || !config.agentSessions.enabled || !repoAgentEnabled(repo)) return null;
  return (
    <select
      class="input agent-picker"
      aria-label={`Agent for ${repo.name}`}
      title="The agent this project's sessions start, saved at once"
      value={repo.agent?.agentId ?? ""}
      disabled={tracking.busy[repo.id] !== undefined}
      onClick={stop}
      onChange={(e) => tracking.setAgent(repo.id, { agentId: e.currentTarget.value || null })}
    >
      <option value="">default agent</option>
      {agents.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name}
        </option>
      ))}
    </select>
  );
}

export const PR_TITLES_TITLE = `PR titles: how Ship asks the agent to title this project's pull requests, saved at once. Conventional Commits adds: "${CONVENTIONAL_COMMITS_SHIP_SENTENCE}"`;

/**
 * The project's pull request title convention, which Ship hands to the agent. Only for a git repository — a folder
 * without git has no Ship — and shown with agent sessions off too: it describes the project, not its sessions.
 */
export function PrTitlesPicker({ repo, isGit, tracking }: { repo: RepoConfig; isGit: boolean; tracking: Tracking }) {
  if (!isGit) return null;
  return (
    <select
      class="input pr-titles-picker"
      aria-label={`PR titles for ${repo.name}`}
      title={PR_TITLES_TITLE}
      value={repo.prTitleConvention ?? ""}
      disabled={tracking.busy[repo.id] !== undefined}
      onClick={stop}
      onChange={(e) => tracking.setPrTitleConvention(repo.id, (e.currentTarget.value || null) as PrTitleConvention | null)}
    >
      <option value="">No convention</option>
      <option value="conventional-commits">Conventional Commits</option>
    </select>
  );
}

/** The pencil beside a project's name. */
export function RenameButton({ id, name, tracking }: { id: string; name: string; tracking: Tracking }) {
  return (
    <button
      type="button"
      class="btn sm ghost icon-only rename"
      aria-label={`Rename ${name}`}
      title="Rename: the name shown in the dashboard, saved at once. The folder is not renamed."
      disabled={tracking.busy[id] !== undefined}
      onClick={(e) => {
        e.stopPropagation();
        tracking.startRename(id);
      }}
    >
      <IconPencil size={12} />
    </button>
  );
}

/**
 * The name as an input, in place. Enter and leaving the field save; Escape cancels. The flag on the element keeps the
 * blur that follows Enter or Escape (the input goes away) from saving a second time.
 */
export function RenameField({ id, name, tracking }: { id: string; name: string; tracking: Tracking }) {
  const done = (el: HTMLInputElement) => {
    if (el.dataset.done) return true;
    el.dataset.done = "1";
    return false;
  };
  return (
    <input
      class="input rename-input"
      aria-label={`New name for ${name}`}
      defaultValue={name}
      // biome-ignore lint/a11y/noAutofocus: the field replaces the name the user just chose to edit
      autoFocus
      disabled={tracking.busy[id] === "rename"}
      onClick={stop}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Escape") {
          e.preventDefault();
          if (!done(e.currentTarget)) tracking.cancelRename();
        } else if (e.key === "Enter") {
          e.preventDefault();
          const el = e.currentTarget;
          tracking.rename(id, name, el.value);
          // A refused blank name keeps the field open; anything else closes it.
          if (el.value.trim()) el.dataset.done = "1";
        }
      }}
      onBlur={(e) => {
        if (!done(e.currentTarget)) tracking.rename(id, name, e.currentTarget.value);
      }}
    />
  );
}

/** Opens the project's labels dialog. */
export function LabelsButton({ id, name, tracking }: { id: string; name: string; tracking: Tracking }) {
  return (
    <button
      type="button"
      class="btn sm ghost icon-only"
      aria-label={`Labels of ${name}`}
      title="Labels: your own, and the detected ones you can hide — saved at once"
      onClick={(e) => {
        e.stopPropagation();
        tracking.openLabels(id);
      }}
    >
      <IconTag />
    </button>
  );
}

/**
 * The gear of a project's row or tile, found again by its project when a dialog closes: the element that opened the
 * dialog may be gone by then (Labels replaced the settings dialog), the gear is not.
 */
export function settingsButtonOf(id: string): () => HTMLElement | null {
  return () => [...document.querySelectorAll<HTMLElement>("[data-project-settings]")].find((el) => el.dataset.projectSettings === id) ?? null;
}

/** Opens the project's settings dialog; on a row and a tile alike. */
export function SettingsButton({ id, name, tracking }: { id: string; name: string; tracking: Tracking }) {
  return (
    <button
      type="button"
      class="btn sm ghost icon-only settings-btn"
      data-project-settings={id}
      aria-label={`Settings of ${name}`}
      title="Settings: this project's agent sessions, agent, PR titles, docs auto-merge, labels and Disable"
      onClick={(e) => {
        e.stopPropagation();
        tracking.openSettings(id);
      }}
    >
      <IconSettings size={15} />
    </button>
  );
}

/** One labelled line of the settings dialog; nothing when the control does not apply to the project. */
export function SettingLine({ label, children }: { label: string; children: ComponentChildren }) {
  if (children === null || children === undefined) return null;
  return (
    <div class="setting-line">
      <span class="setting-label">{label}</span>
      {children}
    </div>
  );
}

/**
 * One project's settings, Labels and Disable, in a dialog that rows and tiles open alike. The controls are called as
 * functions so one that does not apply (null) leaves no line behind. Its saving state and error are the project's, as
 * in the labels dialog.
 */
export function ProjectSettingsDialog({ repo, config, isGit, tracking }: { repo: RepoConfig; config: Config; isGit: boolean; tracking: Tracking }) {
  const busy = tracking.busy[repo.id];
  const error = tracking.errors[repo.id];
  return (
    <Modal label={`Settings of ${repo.name}`} title="Settings" subtitle={repo.name} icon={<IconSettings />} onClose={tracking.closeSettings} returnFocus={settingsButtonOf(repo.id)}>
      <div class="project-settings">
        <SettingLine label="Agent sessions">{AgentToggle({ repo, config, tracking })}</SettingLine>
        <SettingLine label="Agent">{AgentPicker({ repo, config, tracking })}</SettingLine>
        <SettingLine label="PR titles">{PrTitlesPicker({ repo, isGit, tracking })}</SettingLine>
        <SettingLine label="Docs auto-merge">{AutoMergeToggle({ repo, config, isGit, tracking, short: true })}</SettingLine>
        <SettingLine label="Labels">{LabelsButton({ id: repo.id, name: repo.name, tracking })}</SettingLine>
        <div class="setting-line setting-disable">
          <span class="setting-label">Stop tracking</span>
          <DisableButton id={repo.id} name={repo.name} tracking={tracking} />
        </div>
        <p class="hint settings-status" aria-live="polite">
          {busy === "disable" ? "Disabling…" : busy ? "Saving…" : ""}
        </p>
        {error && (
          <div class="notice danger" role="alert">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
}

/** The labels editor for one project, in a dialog; every edit is saved at once. */
export function RepoLabelsDialog({ repo, repos, detected, labelColors, tracking }: { repo: RepoConfig; repos: RepoConfig[]; detected: DetectedLabel[]; labelColors?: Config["labelColors"]; tracking: Tracking }) {
  const busy = tracking.busy[repo.id] === "labels";
  const error = tracking.errors[repo.id];
  return (
    <Modal label={`Labels of ${repo.name}`} title="Labels" subtitle={repo.name} icon={<IconTag />} onClose={tracking.closeLabels} returnFocus={settingsButtonOf(repo.id)}>
      <p class="hint">
        Your labels group projects on the overview. Labels marked with the scan icon were detected from the repository's files; activate one to hide it for this project. The
        swatch before a label chooses its colour on every project. Every change is saved at once.
      </p>
      <RepoLabelsEditor
        repo={repo}
        detected={detected}
        suggestions={labelSuggestions(repos, repo.id)}
        colors={labelColors}
        onChange={(patch) => tracking.setLabels(repo.id, patch)}
        onColor={(label, hue) => tracking.setLabelColor(repo.id, label, hue)}
      />
      <p class="hint" aria-live="polite">
        {busy ? "Saving…" : ""}
      </p>
      {error && (
        <div class="notice danger" role="alert">
          {error}
        </div>
      )}
    </Modal>
  );
}
