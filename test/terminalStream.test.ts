import { afterEach, expect, test } from "bun:test";
import { httpApi, terminalSocketUrl } from "../src/ui/api.ts";

/** Stands in for the browser's WebSocket: records what the HTTP implementation does with it. */
class FakeSocket {
  static last: FakeSocket;
  static OPEN = 1;
  readyState = 0;
  binaryType = "";
  sent: string[] = [];
  closed = false;
  onopen?: () => void;
  onmessage?: (event: { data: unknown }) => void;
  onclose?: () => void;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
}

const globals = globalThis as unknown as { WebSocket: unknown; location: unknown };
const saved = { WebSocket: globals.WebSocket, location: globals.location };
afterEach(() => Object.assign(globals, saved));

test("the product's terminal stream is the session's WebSocket, mapped one to one", () => {
  globals.WebSocket = FakeSocket;
  globals.location = { protocol: "http:", host: "127.0.0.1:4711" };
  const events: string[] = [];
  const connection = httpApi.openTerminal("abc", {
    onOpen: () => events.push("open"),
    onData: (bytes) => events.push(`data:${new TextDecoder().decode(bytes)}`),
    onExit: () => events.push("exit"),
    onSubmitted: (ok) => events.push(`submitted:${ok}`),
    onClose: () => events.push("close"),
  });
  const socket = FakeSocket.last;
  expect(socket.url).toBe(terminalSocketUrl("abc"));
  expect(socket.url).toBe("ws://127.0.0.1:4711/api/sessions/abc/terminal");
  expect(socket.binaryType).toBe("arraybuffer");

  connection.send({ type: "input", data: "too early" }); // not open yet: dropped, as before
  expect(socket.sent).toEqual([]);

  socket.readyState = FakeSocket.OPEN;
  socket.onopen?.();
  connection.send({ type: "resize", cols: 80, rows: 24 });
  connection.send({ type: "input", data: "y\r" });
  connection.send({ type: "submit", data: "Yes, go ahead" });
  socket.onmessage?.({ data: new TextEncoder().encode("hello").buffer });
  socket.onmessage?.({ data: JSON.stringify({ type: "submitted", ok: true }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "submitted", ok: false }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "something-else" }) });
  socket.onmessage?.({ data: JSON.stringify({ type: "exit" }) });
  socket.onclose?.();
  connection.close();

  expect(socket.sent).toEqual(['{"type":"resize","cols":80,"rows":24}', '{"type":"input","data":"y\\r"}', '{"type":"submit","data":"Yes, go ahead"}']);
  expect(events).toEqual(["open", "data:hello", "submitted:true", "submitted:false", "exit", "close"]);
  expect(socket.closed).toBe(true);
});
