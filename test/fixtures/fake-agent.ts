#!/usr/bin/env bun
// A stand-in for an interactive agent CLI: prints how it was started, then echoes every line typed into its terminal.
// "exit" ends it with code 0, "crash" with code 3. Tests never start a real agent.
const args = process.argv.slice(2);
process.stdout.write(`fake-agent ready args=${JSON.stringify(args)} cwd=${process.cwd()} tty=${process.stdout.isTTY === true} key=${"ANTHROPIC_API_KEY" in process.env}\n`);
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
