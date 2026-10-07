// The first-visit tour's pure parts: its steps, which of them are shown, where the step card goes, and the per-browser
// "seen" record. Free of DOM access at import time; the storage helpers tolerate a browser that refuses localStorage.

/** The `data-tour` value of each control a step points at. The app shell and the console button carry these. */
export const TOUR_ANCHOR = {
  projects: "projects",
  board: "board",
  activity: "activity",
  pullRequests: "pull-requests",
  settings: "settings",
  console: "console",
  refresh: "refresh",
  theme: "theme",
  help: "help",
} as const;
export type TourAnchor = (typeof TOUR_ANCHOR)[keyof typeof TOUR_ANCHOR];

export interface TourStep {
  /** The control pointed at; none for a step centred on the page. */
  anchor?: TourAnchor;
  title: string;
  /** At most two sentences. */
  text: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    title: "Welcome to Spec Control",
    text: "One board for the OpenSpec changes in all your repositories, read straight from your files. This short tour shows where things are — press Esc to skip it at any time.",
  },
  {
    anchor: TOUR_ANCHOR.projects,
    title: "Projects",
    text: "Every repository the dashboard tracks, with how far its changes are, and below them the ones it found but does not track yet. Enable a project here to put its changes on the board.",
  },
  {
    anchor: TOUR_ANCHOR.board,
    title: "All changes",
    text: "One Kanban board across every tracked project. Each change sits in the column its artifacts and tasks put it in — from Backlog to Archived.",
  },
  {
    anchor: TOUR_ANCHOR.activity,
    title: "Activity",
    text: "What happened and when: changes created, moved and archived, tasks ticked and sessions started, as the dashboard saw them.",
  },
  {
    anchor: TOUR_ANCHOR.pullRequests,
    title: "Pull requests",
    text: "The open pull requests of your tracked GitHub repositories, read with your own GitHub CLI when you open the view.",
  },
  {
    anchor: TOUR_ANCHOR.settings,
    title: "Settings",
    text: "Start here: add a workspace root, such as ~/Workspace, so the dashboard can find your repositories. Agent sessions, shared config and the environment check live here too.",
  },
  {
    anchor: TOUR_ANCHOR.console,
    title: "Console",
    text: "Opens your agent in a terminal of its own, outside every repository — for drafting a change or any chore.",
  },
  {
    anchor: TOUR_ANCHOR.refresh,
    title: "Refresh",
    text: "Scans your repositories now. The clock beside it repeats that on its own, at an interval you choose for this browser.",
  },
  {
    anchor: TOUR_ANCHOR.theme,
    title: "Theme",
    text: "Cycles System, Light and Dark. The choice is kept in this browser only.",
  },
  {
    anchor: TOUR_ANCHOR.help,
    title: "Help",
    text: "Guidance on every part of the dashboard. You can take this tour again from there.",
  },
];

/** The steps shown: centred ones always, the others only while their control is on screen. */
export function visibleSteps(steps: readonly TourStep[], isPresent: (anchor: TourAnchor) => boolean): TourStep[] {
  return steps.filter((s) => s.anchor === undefined || isPresent(s.anchor));
}

/** "3 of 8", counting only the steps shown; `index` is 0-based. */
export function stepLabel(index: number, count: number): string {
  return `${index + 1} of ${count}`;
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Placement {
  top: number;
  left: number;
  width: number;
}

/** Space kept between the step card and the window edge. */
export const TOUR_GUTTER = 16;
/** Space between the highlighted control and the step card. */
const GAP = 12;
/** Below this width the card spans the window, gutters aside. */
export const NARROW_PX = 480;

/**
 * Where the step card goes: centred without an anchor; otherwise below the anchor, else above it, horizontally centred
 * on it and kept inside the window. Only when neither side has room does it sit at the bottom edge, over the page.
 */
export function cardPlacement(anchor: Rect | undefined, card: { width: number; height: number }, viewport: { width: number; height: number }): Placement {
  const g = TOUR_GUTTER;
  const width = viewport.width < NARROW_PX ? viewport.width - 2 * g : Math.min(card.width, viewport.width - 2 * g);
  const clampTop = (top: number) => Math.max(g, Math.min(top, viewport.height - g - card.height));
  if (!anchor) return { top: clampTop((viewport.height - card.height) / 2), left: (viewport.width - width) / 2, width };
  const left = viewport.width < NARROW_PX ? g : Math.max(g, Math.min(anchor.left + anchor.width / 2 - width / 2, viewport.width - g - width));
  const below = anchor.top + anchor.height + GAP;
  const above = anchor.top - GAP - card.height;
  if (below + card.height <= viewport.height - g) return { top: below, left, width };
  if (above >= g) return { top: above, left, width };
  return { top: clampTop(viewport.height - g - card.height), left, width };
}

export const TOUR_STORAGE_KEY = "openspec-dashboard.tour";
const SEEN = "seen";

type KeyValueStore = Pick<Storage, "getItem" | "setItem">;

/** Whether this browser finished or skipped the tour. Anything but the exact marker, or no storage, is "not seen". */
export function loadTourSeen(storage?: KeyValueStore): boolean {
  try {
    return (storage ?? localStorage).getItem(TOUR_STORAGE_KEY) === SEEN;
  } catch {
    return false;
  }
}

export function saveTourSeen(storage?: KeyValueStore): void {
  try {
    (storage ?? localStorage).setItem(TOUR_STORAGE_KEY, SEEN);
  } catch {
    // Storage unavailable: the tour simply starts again on the next load.
  }
}

let autoStart = true;

/** The demo build turns this off, so its first view and screenshots show the dashboard without the tour. */
export function setTourAutoStart(on: boolean): void {
  autoStart = on;
}

export function tourAutoStarts(): boolean {
  return autoStart;
}

/** Whether the tour starts by itself now: once per load, in a browser that has not seen it, with no overlay in the way. */
export function shouldAutoStart(state: { enabled: boolean; seen: boolean; alreadyStarted: boolean; ready: boolean; overlayOpen: boolean }): boolean {
  return state.enabled && !state.seen && !state.alreadyStarted && state.ready && !state.overlayOpen;
}
