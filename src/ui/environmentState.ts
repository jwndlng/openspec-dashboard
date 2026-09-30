// Pure helpers for the environment report (openspec/specs/environment-check): what the Settings section, its navigation
// count and the hero indicator each make of one report. No DOM, no fetching — the app shell owns the state.
import { environmentProblems, type EnvironmentReport, type EnvironmentStatus } from "../shared/types.ts";

export interface EnvironmentState {
  report?: EnvironmentReport;
  /** A report is being computed right now: the first load, or **Re-check**. */
  loading: boolean;
  /** Why the last request failed. The section says so and keeps **Re-check**; nothing outside it warns. */
  error?: string;
}

/** Status in words: colour must never be the only thing that carries it. */
export const ENVIRONMENT_STATUS_LABEL: Readonly<Record<EnvironmentStatus, string>> = {
  ok: "ok",
  warning: "warning",
  problem: "problem",
  "not-needed": "not needed",
};

/** Badge variant per status. `not-needed` gets the plain badge: de-emphasised, still readable. */
export const ENVIRONMENT_STATUS_BADGE: Readonly<Record<EnvironmentStatus, string>> = {
  ok: "badge success",
  warning: "badge warning",
  problem: "badge danger",
  "not-needed": "badge",
};

/**
 * The figure beside "Environment", in the navigation and in the section heading: how many checks the user is meant to
 * act on. A pending indicator while a report is being computed, and nothing at all when none could be loaded.
 */
export function environmentCount(state: EnvironmentState): string | undefined {
  if (state.loading) return "…";
  if (!state.report) return undefined;
  return String(environmentProblems(state.report));
}

/** Whether that figure is worth the user's attention. Never while a report is pending or missing. */
export function environmentAttention(state: EnvironmentState): boolean {
  return !state.loading && state.report !== undefined && environmentProblems(state.report) > 0;
}

/**
 * What the hero shows, or undefined when it shows nothing: a failed request is not itself something to warn about on
 * the board, and neither is a report that has not arrived.
 */
export function environmentWarning(state: EnvironmentState): { count: number; title: string } | undefined {
  if (state.error !== undefined || !state.report) return undefined;
  const failing = state.report.checks.filter((check) => check.status === "warning" || check.status === "problem");
  if (failing.length === 0) return undefined;
  return { count: failing.length, title: `Needs attention: ${failing.map((check) => check.label).join(", ")}` };
}
