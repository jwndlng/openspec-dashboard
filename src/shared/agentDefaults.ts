/** Always allowed in an agent session; repositories can add to it, nothing can bypass it (design.md D6). */
export const DEFAULT_ALLOWED_TOOLS: readonly string[] = [
  "Read",
  "Glob",
  "Grep",
  "Edit",
  "Write",
  "Bash(openspec *)",
  "Bash(git status*)",
  "Bash(git diff*)",
  "Bash(git log*)",
  "Bash(git add *)",
  "Bash(git commit *)",
  "Bash(git branch -m *)",
];
