// The OpenSpec framework module (support-spec-frameworks design D4): `openspec/changes/<name>/` with a `.openspec.yaml`
// marker, archives under `openspec/changes/archive/YYYY-MM-DD-<name>/`, artifact status from the schema's artifact graph
// (only through `adapter.ts`), and delta specs checked against `openspec/specs/`.
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { FRAMEWORK_INFO } from "../../../shared/types.ts";
import type { ChangeDirEntry, RepoSource } from "../../source.ts";
import { type ChangeScaffold, type FrameworkChange, type FrameworkChangeOutputs, type FrameworkLayout, type FrameworkProject, SpecFramework, type SpecSyncResult } from "../framework.ts";
import { DEFAULT_SCHEMA, readChangeArtifacts } from "./adapter.ts";
import { parseMarker } from "./marker.ts";
import { changeSpecsSynced } from "./specSync.ts";

const ROOT = "openspec";
/** The marker that makes a directory an OpenSpec project — and, once it appears, an integration that worked. */
const PROJECT_MARKERS = ["openspec/config.yaml", "openspec/config.yml"];
const CONFIG_FILE = "openspec/config.yaml";
const CHANGE_MARKER = ".openspec.yaml";

export class OpenSpecFramework extends SpecFramework {
  readonly id = "openspec";
  readonly layout: FrameworkLayout = {
    root: ROOT,
    changesDir: FRAMEWORK_INFO.openspec.changesDir,
    archiveDir: `${FRAMEWORK_INFO.openspec.changesDir}/archive`,
    skipDirs: [ROOT],
  };
  override readonly sharedConfigFile = CONFIG_FILE;

  async isProject(dir: string): Promise<boolean> {
    for (const marker of PROJECT_MARKERS) {
      try {
        if ((await stat(join(dir, marker))).isFile()) return true;
      } catch {
        // not present
      }
    }
    return false;
  }

  /** The schema from `openspec/config.yaml`; a linked worktree without its own falls back to the main checkout's. */
  override async readProject(source: RepoSource, inherited?: FrameworkProject): Promise<FrameworkProject> {
    const schema = parseMarker(await source.readText(join(source.path, CONFIG_FILE))).schema ?? inherited?.schema;
    return schema ? { schema } : {};
  }

  async readChange(source: RepoSource, project: FrameworkProject, entry: ChangeDirEntry): Promise<FrameworkChange> {
    const { outputs: _, ...change } = await this.readChangeOutputs(source, project, entry);
    return change;
  }

  async readChangeOutputs(source: RepoSource, project: FrameworkProject, entry: ChangeDirEntry): Promise<FrameworkChangeOutputs> {
    const marker = parseMarker(await source.readText(join(entry.dir, CHANGE_MARKER)));
    const created = marker.created;
    try {
      const info = readChangeArtifacts(source.path, entry.name, {
        changeDir: entry.dir,
        schemaName: marker.schema ?? project.schema,
        skipSpecs: marker.skipSpecs,
      });
      return { schema: info.schema, artifacts: info.artifacts, tasksPath: info.tasksPath, created, outputs: info.outputs, warnings: [] };
    } catch (err) {
      // An unknown schema, typically: there is no artifact list to offer.
      return {
        schema: marker.schema ?? project.schema ?? "unknown",
        artifacts: [],
        created,
        outputs: {},
        warnings: [`could not read artifacts: ${err instanceof Error ? err.message : String(err)}`],
      };
    }
  }

  override specsSynced(source: RepoSource, entry: ChangeDirEntry): Promise<SpecSyncResult> {
    return changeSpecsSynced(source, entry.dir);
  }

  /** `.openspec.yaml` naming the project's schema and today's date, as `openspec new change` writes it. */
  scaffold({ project, today }: { project: FrameworkProject; today: string }): ChangeScaffold {
    return { [CHANGE_MARKER]: `schema: ${project.schema ?? DEFAULT_SCHEMA}\ncreated: ${today}\n` };
  }
}

export const openSpec = new OpenSpecFramework();
