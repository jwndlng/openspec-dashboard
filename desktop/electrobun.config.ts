import type { ElectrobunConfig } from "electrobun";

// The release tag without its `v`; local builds are 0.0.0. The bundled binary carries the tag itself.
const version = (process.env.SPEC_CONTROL_VERSION ?? "").replace(/^v/, "") || "0.0.0";

// Developer ID signing and notarisation only when their credentials are set; releases ship without them, ad-hoc signed
// by scripts/adhoc-sign.ts, and so does a local build.
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
  // Without a Developer ID the app is ad-hoc signed instead: Apple silicon runs no unsigned code (unsigned-macos-app).
  scripts: {
    postBuild: "scripts/adhoc-sign.ts",
    postWrap: "scripts/adhoc-sign.ts",
  },
  // No `release.baseUrl` and no Updater: the app never fetches anything (desktop-app spec). Updates are a separate change.
} satisfies ElectrobunConfig;
