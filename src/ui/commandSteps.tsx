// How to fix a check (environment-check: instructions), shown in Settings' Environment section and in the setup wizard.
// Each command is shown and copied, never run: the dashboard has no way to run anything the user did not start.
import type { InstructionStep } from "../shared/types.ts";
import { CopyButton } from "./kanban.tsx";

export function CommandSteps({ steps }: { steps: readonly InstructionStep[] }) {
  return (
    <ol class="command-steps">
      {steps.map((step, i) => (
        <li key={i}>
          <span>{step.text}</span>
          {step.command !== undefined && (
            <span class="command">
              <code>{step.command}</code>
              <CopyButton text={step.command} label="Copy" />
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
