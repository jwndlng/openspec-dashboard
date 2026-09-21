// Default responses for the agent console. A response is nothing but terminal input: its text, optionally
// followed by Enter. Kept as data so a configurable source can replace the constant later.
export interface QuickReply {
  id: string;
  label: string;
  /** Typed into the agent's terminal exactly as written. */
  text: string;
  /** Press Enter after the text. */
  submit: boolean;
}

export const DEFAULT_QUICK_REPLIES: readonly QuickReply[] = [
  { id: "go-ahead", label: "Yes, go ahead", text: "Yes, go ahead", submit: true },
  { id: "create-pr", label: "Yes, create a PR", text: "Yes, create a PR", submit: true },
  { id: "stop", label: "No, stop here", text: "No, stop here", submit: true },
];

/** What is written to the terminal: one message, so the text and its Enter cannot interleave with typed keys. */
export function replyInput(reply: QuickReply): string {
  return reply.submit ? `${reply.text}\r` : reply.text;
}

export function replyHint(reply: QuickReply): string {
  return reply.submit ? `types "${reply.text}" and presses Enter` : `types "${reply.text}" without pressing Enter`;
}
