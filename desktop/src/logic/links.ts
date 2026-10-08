// Which URLs stay in the app window and which go to the default browser (design D5). The window shows only the
// loopback origin of the server; every other web or mail link is handed to the system, anything else is dropped.

export type LinkTarget = { kind: "internal" } | { kind: "external"; url: string } | { kind: "drop" };

/** The server's own origin; the only one the window may show. */
export function appOrigin(port: number): string {
  return `http://127.0.0.1:${port}`;
}

/** Electrobun's navigation rules, last match wins: block everything, then allow the server's origin. */
export function navigationRules(port: number): string[] {
  return ["^*", `${appOrigin(port)}/*`];
}

export function externalTarget(raw: string, port: number): LinkTarget {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { kind: "drop" };
  }
  if (url.origin === appOrigin(port)) return { kind: "internal" };
  if (url.protocol === "https:" || url.protocol === "http:" || url.protocol === "mailto:") return { kind: "external", url: url.href };
  return { kind: "drop" };
}

/** The URL an Electrobun navigation event carries: its `data` is a URL string, `{ url }`, or `{ detail }` holding either. */
export function eventUrl(data: unknown): string | undefined {
  if (typeof data === "string") {
    try {
      return eventUrl(JSON.parse(data));
    } catch {
      return data;
    }
  }
  if (data && typeof data === "object") {
    const record = data as { url?: unknown; detail?: unknown };
    if (typeof record.url === "string") return record.url;
    if (record.detail !== undefined) return eventUrl(record.detail);
  }
  return undefined;
}
