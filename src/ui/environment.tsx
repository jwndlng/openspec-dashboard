// The Environment section of Settings (openspec/specs/environment-check): every check the report made, in its order,
// with what was found and how to fix it. Hook-free on purpose — the app shell owns the report, so this renders one.
import { CommandSteps } from "./commandSteps.tsx";
import { IconRefresh } from "./icons.tsx";
import { ENVIRONMENT_STATUS_BADGE, ENVIRONMENT_STATUS_LABEL, environmentCount, type EnvironmentState } from "./environmentState.ts";

export function EnvironmentPanel({ state, onRecheck }: { state: EnvironmentState; onRecheck: () => void }) {
  const count = environmentCount(state);
  return (
    <section class="panel">
      <h2>
        Environment {count !== undefined && <span class="hint">· {count === "…" ? "checking…" : `${count} ${count === "1" ? "needs" : "need"} attention`}</span>}
      </h2>
      <p class="hint">
        What this machine needs for the dashboard and the agents it starts. Everything here is read locally: nothing is contacted over the network and nothing in a tracked
        repository is read or written.
      </p>
      <div class="row">
        <button type="button" class="btn sm" onClick={onRecheck} disabled={state.loading}>
          <IconRefresh size={13} />
          {state.loading ? "Checking…" : "Re-check"}
        </button>
        {state.report && <span class="hint">checked {new Date(state.report.checkedAt).toLocaleTimeString()}</span>}
      </div>
      {state.error !== undefined && <div class="notice danger">The environment could not be checked: {state.error}</div>}
      {state.report === undefined && state.error === undefined && <p class="hint">Checking this machine…</p>}
      {state.report && (
        // The remedy column exists only when something needs fixing; otherwise the paths get its width.
        <div class={`list ${state.report.checks.some((check) => check.remedy !== undefined) ? "with-remedies" : ""}`}>
          {state.report.checks.map((check) => (
            <div key={check.id} class={`item env-check ${check.status === "not-needed" ? "muted" : ""}`}>
              <span class={ENVIRONMENT_STATUS_BADGE[check.status]}>{ENVIRONMENT_STATUS_LABEL[check.status]}</span>
              <span class="label">{check.label}</span>
              <span class="path" title={check.found}>
                {check.found}
              </span>
              {check.remedy !== undefined && <span class="hint remedy">{check.remedy}</span>}
              {check.instructions !== undefined && check.instructions.length > 0 && <CommandSteps steps={check.instructions} />}
            </div>
          ))}
        </div>
      )}
      {state.report?.caveat !== undefined && <p class="hint">{state.report.caveat}</p>}
    </section>
  );
}
