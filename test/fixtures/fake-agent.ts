#!/usr/bin/env bun
// A stand-in for an interactive agent CLI: prints how it was started, then echoes every line typed into its terminal.
// "exit" ends it with code 0, "crash" with code 3. Tests never start a real agent.
// With `--menu` it behaves like a selection menu instead: raw mode, typed characters are neither echoed nor shown,
// and an Enter "confirms the highlighted option" — which the tests then see. Ctrl-D ends it.
const args = process.argv.slice(2);
process.stdout.write(`fake-agent ready args=${JSON.stringify(args)} cwd=${process.cwd()} tty=${process.stdout.isTTY === true} key=${"ANTHROPIC_API_KEY" in process.env}\n`);
if (args.includes("--menu")) {
  process.stdin.setRawMode?.(true);
  process.stdout.write(" > No, exit\r\n   Yes, continue\r\n Enter to confirm\r\n");
  for await (const chunk of process.stdin) {
    const bytes = chunk as Uint8Array;
    if (bytes.includes(4)) process.exit(0);
    if (bytes.includes(13) || bytes.includes(10)) process.stdout.write("menu confirmed by Enter\r\n");
  }
  process.exit(0);
}
let buffer = "";
for await (const chunk of process.stdin) {
  buffer += new TextDecoder().decode(chunk as Uint8Array);
  let newline = buffer.search(/[\r\n]/);
  while (newline >= 0) {
    const line = buffer.slice(0, newline).trim();
    buffer = buffer.slice(newline + 1);
    if (line === "exit") process.exit(0);
    if (line === "crash") process.exit(3);
    if (line) process.stdout.write(`you said: ${line} (cols=${process.stdout.columns})\n`);
    newline = buffer.search(/[\r\n]/);
  }
}
process.exit(0);

export {};
