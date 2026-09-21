import { expect, test } from "bun:test";
import { DEFAULT_QUICK_REPLIES, replyHint, replyInput, type QuickReply } from "../src/ui/quickReplies.ts";

const isControl = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
};

test("the default responses and their order", () => {
  expect(DEFAULT_QUICK_REPLIES.map((r) => r.label)).toEqual(["Yes, go ahead", "Yes, create a PR", "No, stop here"]);
  expect(new Set(DEFAULT_QUICK_REPLIES.map((r) => r.id)).size).toBe(DEFAULT_QUICK_REPLIES.length);
});

test("a default response types exactly its label and never presses Enter", () => {
  // In a selection menu the agent ignores typed text and Enter confirms the highlighted option, so defaults only type.
  for (const reply of DEFAULT_QUICK_REPLIES) {
    expect(reply.text).toBe(reply.label);
    expect(reply.submit).toBe(false);
    const input = replyInput(reply);
    expect(input).toBe(reply.text);
    expect([...input].some(isControl)).toBe(false);
  }
});

test("default responses contain no control characters themselves", () => {
  for (const reply of DEFAULT_QUICK_REPLIES) expect([...reply.text].some(isControl)).toBe(false);
});

test("a response may opt into submitting: text and one Enter in a single input", () => {
  const reply: QuickReply = { id: "x", label: "Continue", text: "continue", submit: true };
  const input = replyInput(reply);
  expect(input).toBe("continue\r");
  expect([...input].filter(isControl)).toEqual(["\r"]);
  expect(replyHint(reply)).toBe('types "continue" and presses Enter');
  expect(replyHint(DEFAULT_QUICK_REPLIES[0])).toBe('types "Yes, go ahead" — press Enter to send');
});
