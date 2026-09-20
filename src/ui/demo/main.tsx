// Entry point of the demo build: the real UI on the in-memory API, with hash routing so it works from any static
// host, a sub-path or file://. The normal entry point (../main.tsx) must never import from this directory.
import { render } from "preact";
import { setApi } from "../api.ts";
import { App } from "../app.tsx";
import { setRoutingMode } from "../url.ts";
import { DemoBanner } from "./banner.tsx";
import { createDemoApi } from "./demoApi.ts";

setApi(createDemoApi());
setRoutingMode("hash");

const root = document.getElementById("app");
if (!root) throw new Error("missing #app mount point");
render(
  <>
    <DemoBanner />
    <App />
  </>,
  root,
);
