// The branch an agent session works on. The server creates it (`src/server/sessions/manager.ts`) and the UI links a
// change's pull request by it (`pullRequestLink.ts`), so both read the name from here and can never disagree.
import type { SessionAction } from "./types.ts";

/** Archiving gets a branch of its own; every other action works on the change's implementation branch. */
export function sessionBranch(action: SessionAction, change: string): string {
  return action === "archive" ? `chore/archive-${change}` : `feat/${change}`;
}
