// Default responses for the agent console. A response is nothing but terminal input: its text, optionally
// followed by Enter. Kept as data so a configurable source can replace the constant later.
//
// The defaults do NOT press Enter. A terminal cannot tell us whether the agent shows a text prompt or a selection
// menu, and in a menu the typed text is ignored while Enter confirms whatever is highlighted (verified with the
// preconfigured agent: "Yes, go ahead" + Enter selected "No, exit"). Typing only is harmless in both cases.
export interface QuickReply {
  id: string;
  label: string;
  /** Typed into the agent's terminal exactly as written. */
  text: string;
  /** Press Enter after the text. */
  submit: boolean;
}

export const DEFAULT_QUICK_REPLIES: readonly QuickReply[] = [
  { id: "go-ahead", label: "Yes, go ahead", text: "Yes, go ahead", submit: false },
  { id: "create-pr", label: "Yes, create a PR", text: "Yes, create a PR", submit: false },
  { id: "stop", label: "No, stop here", text: "No, stop here", submit: false },
];

/** What is written to the terminal: one message, so the text and its Enter cannot interleave with typed keys. */
export function replyInput(reply: QuickReply): string {
  return reply.submit ? `${reply.text}\r` : reply.text;
}

export function replyHint(reply: QuickReply): string {
  return reply.submit ? `types "${reply.text}" and presses Enter` : `types "${reply.text}" — press Enter to send`;
}
