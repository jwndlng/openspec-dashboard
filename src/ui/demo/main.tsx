// Entry point of the demo build: the real UI on the in-memory API, with hash routing so it works from any static
// host, a sub-path or file://. The normal entry point (../main.tsx) must never import from this directory.
import { render } from "preact";
import { setApi } from "../api.ts";
import { App } from "../app.tsx";
import { migrateStorage } from "../storage.ts";
import { setSetupAutoOpen } from "../setupState.ts";
import { setTourAutoStart } from "../tourState.ts";
import { setRoutingMode } from "../url.ts";
import { DemoBanner } from "./banner.tsx";
import { createDemoApi } from "./demoApi.ts";

// The same keys as the app, so a demo visitor who saw it before the rename keeps theme and tour state.
migrateStorage();
setApi(createDemoApi());
setRoutingMode("hash");
// The demo opens on the dashboard itself, for visitors and for the screenshots taken from it; Help still offers the tour.
setTourAutoStart(false);
// Nor does the setup wizard open by itself; Help's **Run setup again** opens it against the demo's own data.
setSetupAutoOpen(false);

const root = document.getElementById("app");
if (!root) throw new Error("missing #app mount point");
render(
  <>
    <DemoBanner />
    <App />
  </>,
  root,
);
