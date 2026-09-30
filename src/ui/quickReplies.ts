// The console's shortcuts: a control that types a prepared prompt into the running agent. A shortcut is nothing but
// terminal input — the title it shows is never sent, the prompt is sent exactly as written. The set comes from the
// configuration (`agentSessions.shortcuts`), so this module holds no list of its own.
//
// A shortcut is sent through the terminal socket's `submit` message: the server types the prompt and presses Enter only
// once the agent's terminal has shown it (server/sessions/submit.ts). A text prompt shows typed characters, a selection
// menu does not — so one click sends where that is safe, and at a menu nothing is confirmed.
import { DEFAULT_SHORTCUTS } from "../shared/agentDefaults.ts";
import type { Config, Shortcut } from "../shared/types.ts";
import { slugId } from "./sessionState.ts";

/** The terminal socket message for a shortcut: `submit` lets the server send the prompt safely, never a bare Enter. */
export function shortcutMessage(shortcut: Shortcut): { type: "submit"; data: string } {
  return { type: "submit", data: shortcut.prompt };
}

/** What the control says it will do: the prompt, because the title is not what the agent receives. */
export function shortcutHint(shortcut: Shortcut): string {
  return `sends "${shortcut.prompt}"`;
}

/**
 * The shortcuts the panel offers: the configured ones, and none at all unless the session is running with its terminal
 * connected. An empty result means no row and no label — a terminal, as it was before shortcuts existed.
 */
export function visibleShortcuts(config: Config | null | undefined, running: boolean, connected: boolean): readonly Shortcut[] {
  if (!running || !connected) return [];
  return config?.agentSessions.shortcuts ?? [];
}

/** `list` with the shortcut at `index` moved by `delta`, unchanged when that would leave the list. */
export function moveShortcut(list: readonly Shortcut[], index: number, delta: number): Shortcut[] {
  const to = index + delta;
  if (index < 0 || index >= list.length || to < 0 || to >= list.length) return [...list];
  const moved = [...list];
  const [shortcut] = moved.splice(index, 1);
  moved.splice(to, 0, shortcut);
  return moved;
}

/** `list` without the shortcut `id`, the rest in order. */
export function removeShortcut(list: readonly Shortcut[], id: string): Shortcut[] {
  return list.filter((shortcut) => shortcut.id !== id);
}

/** `list` with an empty shortcut appended, its id unique among the ones already there. */
export function addShortcut(list: readonly Shortcut[]): Shortcut[] {
  return [...list, { id: slugId("shortcut", list.map((shortcut) => shortcut.id)), title: "New shortcut", prompt: "" }];
}

/** The shipped shortcuts as an editable list: what "Restore defaults" puts in the draft. */
export function restoredShortcuts(): Shortcut[] {
  return structuredClone(DEFAULT_SHORTCUTS) as Shortcut[];
}

/** Shown when text sent on the user's behalf was typed but Enter was withheld. */
export const NOT_SUBMITTED_NOTICE = "The agent did not show the text — it may be showing a menu. The text was typed but not sent; nothing was confirmed.";
