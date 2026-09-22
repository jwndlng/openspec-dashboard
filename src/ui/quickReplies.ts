// Default responses for the agent console. A response is nothing but terminal input: its text, optionally
// followed by Enter. Kept as data so a configurable source can replace the constant later.
//
// A response with `submit` is sent through the terminal socket's `submit` message: the server types it and presses
// Enter only once the agent's terminal has shown the text (server/sessions/submit.ts). A text prompt shows typed
// characters, a selection menu does not — so one click sends where that is safe, and at a menu nothing is confirmed.
// A response without `submit` is plain typed input.
export interface QuickReply {
  id: string;
  label: string;
  /** Typed into the agent's terminal exactly as written. */
  text: string;
  /** Send it, rather than only typing it. */
  submit: boolean;
}

export const DEFAULT_QUICK_REPLIES: readonly QuickReply[] = [
  { id: "go-ahead", label: "Yes, go ahead", text: "Yes, go ahead", submit: true },
  { id: "create-pr", label: "Yes, create a PR", text: "Yes, create a PR", submit: true },
  { id: "resolve-conflicts", label: "Resolve PR conflicts", text: "Resolve PR conflicts", submit: true },
  { id: "stop", label: "No, stop here", text: "No, stop here", submit: true },
];

/** The terminal socket message for a response: `submit` lets the server send it safely, `input` only types it. */
export function replyMessage(reply: QuickReply): { type: "submit" | "input"; data: string } {
  return { type: reply.submit ? "submit" : "input", data: reply.text };
}

export function replyHint(reply: QuickReply): string {
  return reply.submit ? `sends "${reply.text}"` : `types "${reply.text}" — press Enter to send`;
}

/** Shown when text sent on the user's behalf was typed but Enter was withheld. */
export const NOT_SUBMITTED_NOTICE = "The agent did not show the text — it may be showing a menu. The text was typed but not sent; nothing was confirmed.";
