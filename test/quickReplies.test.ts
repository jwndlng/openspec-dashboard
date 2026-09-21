import { expect, test } from "bun:test";
import { DEFAULT_QUICK_REPLIES, NOT_SUBMITTED_NOTICE, replyHint, replyMessage, type QuickReply } from "../src/ui/quickReplies.ts";

const isControl = (char: string) => {
  const code = char.charCodeAt(0);
  return code < 32 || code === 127;
};

test("the default responses and their order", () => {
  expect(DEFAULT_QUICK_REPLIES.map((r) => r.label)).toEqual(["Yes, go ahead", "Yes, create a PR", "No, stop here"]);
  expect(new Set(DEFAULT_QUICK_REPLIES.map((r) => r.id)).size).toBe(DEFAULT_QUICK_REPLIES.length);
});

test("a default response is sent with one click: a submit message carrying exactly its label", () => {
  for (const reply of DEFAULT_QUICK_REPLIES) {
    expect(reply.text).toBe(reply.label);
    expect(reply.submit).toBe(true);
    expect(replyMessage(reply)).toEqual({ type: "submit", data: reply.text });
    expect(replyHint(reply)).toBe(`sends "${reply.text}"`);
  }
});

test("the browser never adds Enter or any other control character: pressing Enter is the server's decision", () => {
  for (const reply of DEFAULT_QUICK_REPLIES) expect([...replyMessage(reply).data].some(isControl)).toBe(false);
});

test("a response that does not submit is plain typed input", () => {
  const reply: QuickReply = { id: "x", label: "Draft", text: "draft text", submit: false };
  expect(replyMessage(reply)).toEqual({ type: "input", data: "draft text" });
  expect(replyHint(reply)).toBe('types "draft text" — press Enter to send');
});

test("the notice says that nothing was confirmed", () => {
  expect(NOT_SUBMITTED_NOTICE).toContain("typed but not sent");
  expect(NOT_SUBMITTED_NOTICE).toContain("nothing was confirmed");
});
