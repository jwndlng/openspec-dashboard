import type { ElectrobunConfig } from "electrobun";

// The release tag without its `v`; local builds are 0.0.0. The bundled binary carries the tag itself.
const version = (process.env.SPEC_CONTROL_VERSION ?? "").replace(/^v/, "") || "0.0.0";

// Signing and notarisation only where their credentials are (the release workflow's `desktop` job): a local build
// stays unsigned instead of failing.
const signing = Boolean(process.env.ELECTROBUN_DEVELOPER_ID);

export default {
  app: {
    name: "Spec Control",
    identifier: "ch.wndlng.spec-control",
    version,
    description: "Mission control for every agent change across your repositories.",
  },
  build: {
    mainProcess: "bun",
    bun: {
      entrypoint: "src/main.ts",
    },
    // `scripts/prepare.ts` puts the binary from ../dist and the generated images here.
    copy: {
      "build-assets/spec-control": "bin/spec-control",
      "build-assets/tray-Template.png": "views/assets/tray-Template.png",
      "build-assets/tray-Template@2x.png": "views/assets/tray-Template@2x.png",
    },
    mac: {
      codesign: signing,
      notarize: signing && Boolean(process.env.ELECTROBUN_APPLEAPIKEY),
      createDmg: true,
      defaultRenderer: "native",
      icons: "build-assets/icon.iconset",
      // The bundled binary is a compiled Bun program: its JIT needs these under the hardened runtime.
      entitlements: {
        "com.apple.security.cs.allow-jit": true,
        "com.apple.security.cs.allow-unsigned-executable-memory": true,
      },
    },
  },
  runtime: {
    // Closing the window hides it; the server and its sessions keep running until Quit.
    exitOnLastWindowClosed: false,
  },
  // No `release.baseUrl` and no Updater: the app never fetches anything (desktop-app spec). Updates are a separate change.
} satisfies ElectrobunConfig;
