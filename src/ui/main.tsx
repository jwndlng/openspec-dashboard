import { render } from "preact";
import { App } from "./app.tsx";
import { migrateStorage } from "./storage.ts";

// Before anything reads a preference: keys stored under the pre-rename prefix are copied over once.
migrateStorage();

const root = document.getElementById("app");
if (!root) throw new Error("missing #app mount point");
render(<App />, root);
