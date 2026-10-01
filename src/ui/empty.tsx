import type { Config } from "../shared/types.ts";
import { NewProjectButton } from "./newProject.tsx";
import { href, navigate } from "./url.ts";

/** Shown by the overview and the boards while the snapshot has no repositories. */
export function NoRepos({ config }: { config: Config | null }) {
  const enabled = config?.repos.some((r) => r.enabled);
  return (
    <div class="empty">
      <h1>{enabled ? "Scanning…" : "No repositories tracked yet"}</h1>
      <p>{enabled ? "The first scan is running; this page updates automatically." : "Add a workspace root, discover your OpenSpec repos and enable the ones to track."}</p>
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
        </div>
      )}
    </div>
  );
}
