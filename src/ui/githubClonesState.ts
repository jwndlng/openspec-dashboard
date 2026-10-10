// The one store of GitHub clones the UI keeps (github-repositories): the Add from GitHub dialog, the setup wizard and the
// overview's Unmanaged projects read it, so a clone started in one is seen in the others, and closing the dialog or
// reloading the page loses nothing — the server holds the list. Polled every second while a clone runs, never otherwise.
import { useEffect, useState } from "preact/hooks";
import { api } from "./api.ts";
import { createGithubClonesStore, type GithubClonesState } from "./githubState.ts";

export const githubClones = createGithubClonesStore(() => api.githubClones());

/** The clones as they are now; asks the server once when first used, which also tells whether git is installed. */
export function useGithubClones(): GithubClonesState {
  const [state, setState] = useState(githubClones.get());
  useEffect(() => {
    const unsubscribe = githubClones.subscribe(() => setState(githubClones.get()));
    void githubClones.refresh();
    return unsubscribe;
  }, []);
  return state;
}
