import type { Config } from "../shared/types.ts";
import { AddGithubButton } from "./addGithub.tsx";
import { NewProjectButton } from "./newProject.tsx";
import { href, navigate } from "./url.ts";

/** Shown by the boards while the snapshot has no repositories; the overview shows its own, above the untracked ones. */
export function NoRepos({ config }: { config: Config | null }) {
  const enabled = config?.repos.some((r) => r.enabled);
  return (
    <div class="empty">
      <h1>{enabled ? "Scanning…" : "No repositories tracked yet"}</h1>
      <p>{enabled ? "The first scan is running; this page updates automatically." : "Add a workspace root in Settings, then enable the repositories it finds on Projects."}</p>
      {!enabled && (
        <div class="row actions">
          <a
            class="btn primary"
            href={href("/settings")}
            onClick={(e) => {
              e.preventDefault();
              navigate("/settings");
            }}
          >
            Open Settings
          </a>
          <NewProjectButton config={config} small={false} />
          <AddGithubButton config={config} small={false} />
        </div>
      )}
    </div>
  );
}
