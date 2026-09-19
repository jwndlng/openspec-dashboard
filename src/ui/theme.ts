// Theme preference: pure resolution logic plus thin localStorage/DOM effects.
// The storage key is also used by the pre-paint script in scripts/build-ui.ts.
export const THEME_STORAGE_KEY = "openspec-dashboard.theme";

export type Theme = "light" | "dark";
export type ThemePreference = "system" | Theme;

const ORDER: ThemePreference[] = ["system", "light", "dark"];

export function parsePreference(raw: string | null | undefined): ThemePreference {
  return raw === "light" || raw === "dark" ? raw : "system";
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): Theme {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}

export function nextPreference(pref: ThemePreference): ThemePreference {
  return ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];
}

export function loadPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return "system";
  }
}

export function savePreference(pref: ThemePreference): void {
  try {
    if (pref === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable: the choice still applies for this page session.
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}
