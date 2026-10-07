#!/usr/bin/env bun
// A stand-in for an interactive agent CLI: prints how it was started, then echoes every line typed into its terminal.
// "exit" ends it with code 0, "crash" with code 3. Tests never start a real agent.
// With `--menu` it behaves like a selection menu instead: raw mode, typed characters are neither echoed nor shown,
// and an Enter "confirms the highlighted option" — which the tests then see. Ctrl-D ends it.
// Like a full-screen agent it redraws when its terminal is resized. "report <word>" writes the word into the file
// `SPEC_CONTROL_STATE_FILE` names, as an agent's own hook would; "stream <ms>" prints a line every 100 ms for that long.
const args = process.argv.slice(2);
process.stdout.write(`fake-agent ready args=${JSON.stringify(args)} cwd=${process.cwd()} tty=${process.stdout.isTTY === true} key=${"ANTHROPIC_API_KEY" in process.env} state=${process.env.SPEC_CONTROL_STATE_FILE ?? ""}\n`);
process.on("SIGWINCH", () => process.stdout.write(`redrawn at ${process.stdout.columns} columns\n`));
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
    const report = /^report (\S+)$/.exec(line);
    if (report && process.env.SPEC_CONTROL_STATE_FILE) await Bun.write(process.env.SPEC_CONTROL_STATE_FILE, report[1]);
    const stream = /^stream (\d+)$/.exec(line);
    if (stream) {
      const until = Date.now() + Number(stream[1]);
      void (async () => {
        while (Date.now() < until) {
          process.stdout.write(`streaming ${until - Date.now()}\n`);
          await new Promise((r) => setTimeout(r, 100));
        }
      })();
    }
    if (line) process.stdout.write(`you said: ${line} (cols=${process.stdout.columns})\n`);
    newline = buffer.search(/[\r\n]/);
  }
}
process.exit(0);

export {};
