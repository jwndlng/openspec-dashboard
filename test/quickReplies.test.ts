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

test("a default response types exactly its label and presses Enter once", () => {
  for (const reply of DEFAULT_QUICK_REPLIES) {
    expect(reply.text).toBe(reply.label);
    const input = replyInput(reply);
    expect(input).toBe(`${reply.text}\r`);
    expect([...input].filter(isControl)).toEqual(["\r"]);
  }
});

test("default responses contain no control characters themselves", () => {
  for (const reply of DEFAULT_QUICK_REPLIES) expect([...reply.text].some(isControl)).toBe(false);
});

test("a response that does not submit is typed without Enter", () => {
  const reply: QuickReply = { id: "x", label: "Draft", text: "draft text", submit: false };
  expect(replyInput(reply)).toBe("draft text");
  expect(replyHint(reply)).toBe('types "draft text" without pressing Enter');
  expect(replyHint(DEFAULT_QUICK_REPLIES[0])).toBe('types "Yes, go ahead" and presses Enter');
});
