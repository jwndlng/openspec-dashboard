// The browser storage keys (openspec/specs/kanban-board, "Preferences kept in the browser survive the rename"). Every
// key the UI keeps is `spec-control.<name>`. Keys written before the rename (`openspec-dashboard.<name>`) are copied
// over once per browser, before the first read, and never consulted again — so a preference removed afterwards (the
// theme's `system`) does not come back. The former keys are left in place: an older binary still finds them.
export const STORAGE_PREFIX = "spec-control.";
export const FORMER_STORAGE_PREFIX = "openspec-dashboard.";
export const STORAGE_MIGRATED_KEY = `${STORAGE_PREFIX}migrated`;

export const storageKey = (name: string): string => STORAGE_PREFIX + name;

/** Copies former keys that hold a value to their new names, unless those hold one already. Once per browser. */
export function migrateStorage(storage?: Storage): void {
  try {
    const store = storage ?? localStorage;
    if (store.getItem(STORAGE_MIGRATED_KEY) !== null) return;
    const former: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(FORMER_STORAGE_PREFIX)) former.push(key);
    }
    for (const key of former) {
      const value = store.getItem(key);
      const next = storageKey(key.slice(FORMER_STORAGE_PREFIX.length));
      if (value !== null && store.getItem(next) === null) store.setItem(next, value);
    }
    store.setItem(STORAGE_MIGRATED_KEY, "1");
  } catch {
    // No storage, or it throws: every preference reads as unset, exactly as without the copy.
  }
}
