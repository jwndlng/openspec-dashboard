// The setup wizard (openspec/specs/setup-wizard): five steps over the dimmed page — Welcome, Workspace, Agents, System
// check, Done. Each step saves when the user continues, through the routes Settings and the overview already use, and
// only ever adds. The step views are hook-free, so tests render them without a DOM; `SetupWizard` holds the state.
import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { agentInstallSteps } from "../shared/agentDefaults.ts";
import type { AgentAvailability, Config, DiscoverResult, EnvironmentReport, InstructionStep, SetupState } from "../shared/types.ts";
import { AgentSessionsStatement } from "./agentSettings.tsx";
import { api } from "./api.ts";
import { CommandSteps } from "./commandSteps.tsx";
import { ENVIRONMENT_STATUS_BADGE, ENVIRONMENT_STATUS_LABEL } from "./environmentState.ts";
import { IconRefresh } from "./icons.tsx";
import { type AgentChoice, agentChoices, agentsSave, allInPlace, expandHome, isAbsoluteRoot, preselectedAgent, SETUP_STEPS, type SetupSummary, setupSummary, workspaceSave } from "./setupState.ts";

const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** The frame every step shares: the step list with the current one marked, the step's body, and its controls. */
export function WizardFrame({
  step,
  children,
  onBack,
  onContinue,
  continueLabel = "Continue",
  busy = false,
  onSkip,
  confirmingSkip = false,
  onConfirmSkip,
  onCancelSkip,
  headingRef,
}: {
  step: number;
  children: preact.ComponentChildren;
  onBack?: () => void;
  onContinue: () => void;
  continueLabel?: string;
  busy?: boolean;
  /** Absent on Done, which offers Finish instead. */
  onSkip?: () => void;
  confirmingSkip?: boolean;
  onConfirmSkip?: () => void;
  onCancelSkip?: () => void;
  headingRef?: preact.Ref<HTMLHeadingElement>;
}) {
  return (
    <div class="overlay modal-overlay setup-overlay">
      <div class="modal wide setup-wizard" role="dialog" aria-modal="true" aria-label="Spec Control setup">
        <header class="modal-head setup-head">
          <div class="modal-title">
            <p class="setup-position">
              Setup · {step + 1} of {SETUP_STEPS.length}
            </p>
            <h2 ref={headingRef} tabIndex={-1}>
              {SETUP_STEPS[step]}
            </h2>
          </div>
          <ol class="setup-steps" aria-label="Setup steps">
            {SETUP_STEPS.map((name, i) => (
              <li key={name} class={i === step ? "current" : i < step ? "past" : ""} aria-current={i === step ? "step" : undefined}>
                {name}
              </li>
            ))}
          </ol>
        </header>
        <div class="modal-body setup-body">{children}</div>
        <footer class="setup-actions">
          {confirmingSkip ? (
            <>
              <span class="hint">Skip setup? What you entered on this step is not saved.</span>
              <span class="setup-actions-end">
                <button type="button" class="btn" onClick={onCancelSkip}>
                  Keep going
                </button>
                <button type="button" class="btn danger" onClick={onConfirmSkip}>
                  Skip setup
                </button>
              </span>
            </>
          ) : (
            <>
              {onSkip && (
                <button type="button" class="btn ghost" onClick={onSkip} disabled={busy}>
                  Skip setup
                </button>
              )}
              <span class="setup-actions-end">
                {onBack && (
                  <button type="button" class="btn" onClick={onBack} disabled={busy}>
                    Back
                  </button>
                )}
                <button type="button" class="btn primary" onClick={onContinue} disabled={busy}>
                  {busy ? "Saving…" : continueLabel}
                </button>
              </span>
            </>
          )}
        </footer>
      </div>
    </div>
  );
}

export function WelcomeStep() {
  return (
    <div class="setup-step">
      <p>
        Spec Control shows the OpenSpec changes of the repositories on this machine on one board, and can start your coding agent on any of them. A few things decide whether it
        is useful from the start:
      </p>
      <ul>
        <li>
          <strong>Workspace</strong> — where your projects live, so Spec Control can find them.
        </li>
        <li>
          <strong>Agents</strong> — which coding agent to start, if you want it to start one at all.
        </li>
        <li>
          <strong>System check</strong> — whether the tools it relies on are installed, and how to install what is missing.
        </li>
      </ul>
      <p class="hint">Every step can be skipped and changed later in Settings. You can run setup again from Help.</p>
    </div>
  );
}

export interface WorkspaceView {
  configuredRoots: readonly string[];
  /** Roots entered in this step, already expanded; not saved yet. */
  entered: readonly string[];
  /** Roots discovery reported as missing, with its message. */
  missing: ReadonlyMap<string, string>;
  suggestions: readonly string[];
  input: string;
  inputError?: string;
  discovery?: DiscoverResult;
  discovering: boolean;
  discoveryError?: string;
  unchecked: ReadonlySet<string>;
  saveError?: string;
}

export function WorkspaceStep({
  view,
  onInput,
  onAdd,
  onRemove,
  onToggle,
}: {
  view: WorkspaceView;
  onInput: (text: string) => void;
  onAdd: (path: string) => void;
  onRemove: (path: string) => void;
  onToggle: (path: string) => void;
}) {
  const candidates = view.discovery?.candidates ?? [];
  const integratable = view.discovery?.integratable.length ?? 0;
  const anyRoot = view.configuredRoots.length + view.entered.length > 0;
  return (
    <div class="setup-step">
      <p>Add the folders your repositories live in. Spec Control looks for projects with OpenSpec below them, a few levels deep; nothing is saved until you continue.</p>
      {view.configuredRoots.length > 0 && (
        <ul class="setup-roots" aria-label="Configured workspace roots">
          {view.configuredRoots.map((root) => (
            <li key={root}>
              <code>{root}</code> <span class="hint">configured</span>
            </li>
          ))}
        </ul>
      )}
      {view.entered.length > 0 && (
        <ul class="setup-roots" aria-label="Workspace roots to add">
          {view.entered.map((root) => (
            <li key={root} class={view.missing.has(root) ? "missing" : ""}>
              <code>{root}</code>
              {view.missing.has(root) ? <span class="badge danger">not found — {view.missing.get(root)}</span> : <span class="hint">to add</span>}
              <button type="button" class="btn sm ghost" onClick={() => onRemove(root)} aria-label={`Remove ${root}`}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form
        class="row setup-add-root"
        onSubmit={(e) => {
          e.preventDefault();
          onAdd(view.input);
        }}
      >
        <input type="text" class="input" value={view.input} placeholder="~/Workspace" aria-label="Folder to add" onInput={(e) => onInput(e.currentTarget.value)} />
        <button type="submit" class="btn" disabled={!view.input.trim()}>
          Add folder
        </button>
      </form>
      {view.inputError && <p class="notice danger">{view.inputError}</p>}
      {view.suggestions.length > 0 && (
        <p class="setup-suggestions">
          <span class="hint">Found in your home folder:</span>
          {view.suggestions.map((path) => (
            <button key={path} type="button" class="btn sm" onClick={() => onAdd(path)}>
              + {path}
            </button>
          ))}
        </p>
      )}
      {anyRoot && (
        <div class="setup-found" aria-live="polite">
          {view.discovering && <p class="hint">Looking for projects…</p>}
          {view.discoveryError && <p class="notice danger">Could not look for projects: {view.discoveryError}</p>}
          {view.discovery && candidates.length === 0 && <p class="hint">No OpenSpec projects that are not tracked yet were found under these folders.</p>}
          {candidates.length > 0 && (
            <>
              <p>
                {candidates.length === 1 ? "One project with OpenSpec was found" : `${candidates.length} projects with OpenSpec were found`}. Checked ones are tracked when you
                continue:
              </p>
              <ul class="setup-candidates">
                {candidates.map((c) => (
                  <li key={c.id}>
                    <label class="check">
                      <input type="checkbox" checked={!view.unchecked.has(c.path)} onChange={() => onToggle(c.path)} />
                      <span>{c.name}</span>
                      <code class="hint">{c.path}</code>
                    </label>
                  </li>
                ))}
              </ul>
            </>
          )}
          {integratable > 0 && (
            <p class="hint">
              {integratable === 1 ? "One git repository" : `${integratable} git repositories`} without OpenSpec {integratable === 1 ? "was" : "were"} found as well; you can
              integrate {integratable === 1 ? "it" : "them"} from the projects overview.
            </p>
          )}
        </div>
      )}
      {view.saveError && <p class="notice danger">Could not save: {view.saveError}</p>}
    </div>
  );
}

export interface AgentsView {
  savedEnabled: boolean;
  enable: boolean;
  choices: readonly AgentChoice[];
  agentId: string;
  /** How to install the chosen agent, when it is not found. */
  install?: readonly InstructionStep[];
  saveError?: string;
}

export function AgentsStep({ view, onEnable, onChoose }: { view: AgentsView; onEnable: (on: boolean) => void; onChoose: (id: string) => void }) {
  const chosen = view.choices.find((c) => c.id === view.agentId);
  return (
    <div class="setup-step">
      <AgentSessionsStatement />
      <label class="check">
        <input type="checkbox" checked={view.enable} disabled={view.savedEnabled} onChange={(e) => onEnable(e.currentTarget.checked)} />
        <span>Turn agent sessions on</span>
        {view.savedEnabled && <span class="hint">already on — switch it off in Settings if you need to</span>}
      </label>
      <fieldset class="setup-agents">
        <legend>Default agent</legend>
        {view.choices.map((c) => (
          <label key={c.id} class="check">
            <input type="radio" name="setup-agent" value={c.id} checked={c.id === view.agentId} onChange={() => onChoose(c.id)} />
            <span>{c.name}</span>
            <span class={`badge ${c.available ? "success" : "warning"}`}>{c.available ? "found" : "not found"}</span>
            {!c.configured && <span class="hint">added when you continue</span>}
          </label>
        ))}
      </fieldset>
      {chosen && !chosen.available && view.install && (
        <div class="setup-install">
          <p>{chosen.name} was not found on this machine. To install it:</p>
          <CommandSteps steps={view.install} />
          <p class="hint">You can continue now and install it later; the System check step shows whether it is found.</p>
        </div>
      )}
      {view.saveError && <p class="notice danger">Could not save: {view.saveError}</p>}
    </div>
  );
}

export function SystemCheckStep({ report, loading, error, onRecheck }: { report?: EnvironmentReport; loading: boolean; error?: string; onRecheck: () => void }) {
  return (
    <div class="setup-step">
      <div class="row">
        <p class="grow">The tools Spec Control and your agent rely on, checked on this machine. Nothing is installed or run for you.</p>
        <button type="button" class="btn sm" onClick={onRecheck} disabled={loading}>
          <IconRefresh size={13} />
          {loading ? "Checking…" : "Re-check"}
        </button>
      </div>
      {error !== undefined && <p class="notice danger">The environment could not be checked: {error}</p>}
      {report === undefined && error === undefined && <p class="hint">Checking this machine…</p>}
      {allInPlace(report) && <p class="notice ok">Everything needed is in place.</p>}
      {report && (
        <ul class="setup-checks">
          {report.checks.map((check) => (
            <li key={check.id} class={check.status === "not-needed" ? "muted" : ""}>
              <div class="setup-check-head">
                <span class={ENVIRONMENT_STATUS_BADGE[check.status]}>{ENVIRONMENT_STATUS_LABEL[check.status]}</span>
                <strong>{check.label}</strong>
                <span class="hint">{check.found}</span>
              </div>
              {check.status !== "ok" && check.status !== "not-needed" && (
                <>
                  {check.remedy && <p class="hint">{check.remedy}</p>}
                  {check.instructions && check.instructions.length > 0 && <CommandSteps steps={check.instructions} />}
                </>
              )}
            </li>
          ))}
        </ul>
      )}
      {report?.caveat && <p class="hint">{report.caveat}</p>}
      <p class="hint">You can continue whatever this says; Settings → Environment shows the same report later.</p>
    </div>
  );
}

export function DoneStep({ summary }: { summary: SetupSummary }) {
  return (
    <div class="setup-step">
      <ul class="setup-summary">
        <li>
          {summary.rootsAdded.length === 0 ? (
            "No workspace folder was added."
          ) : (
            <>
              Workspace {summary.rootsAdded.length === 1 ? "folder" : "folders"} added: {summary.rootsAdded.map((r, i) => (
                <span key={r}>
                  {i > 0 && ", "}
                  <code>{r}</code>
                </span>
              ))}
            </>
          )}
        </li>
        <li>{summary.tracked === 0 ? "No project was tracked." : summary.tracked === 1 ? "One project is tracked." : `${summary.tracked} projects are tracked.`}</li>
        <li>{summary.agentSessions ? `Agent sessions are on, with ${summary.defaultAgent ?? "the default agent"} as the default agent.` : "Agent sessions are off."}</li>
      </ul>
      {summary.remaining.length > 0 ? (
        <p class="notice warn">Still needing attention: {summary.remaining.join(", ")}. Settings → Environment shows how to fix them.</p>
      ) : (
        <p class="hint">Nothing in the system check needs attention.</p>
      )}
      <p class="hint">Change any of this in Settings and on the projects overview. Run setup again from Help.</p>
    </div>
  );
}

/**
 * The wizard. `onSaved` receives every configuration a step saved; `onClose` is told whether setup could be marked done
 * (when not, the wizard opens again on the next load, which is the safe direction).
 */
export function SetupWizard({ config, onSaved, onClose }: { config: Config | null; onSaved: (config: Config) => void; onClose: (done: boolean) => void }) {
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmingSkip, setConfirmingSkip] = useState(false);
  const [info, setInfo] = useState<SetupState>();
  const heading = useRef<HTMLHeadingElement>(null);

  // Workspace.
  const [entered, setEntered] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string>();
  const [discovery, setDiscovery] = useState<{ result?: DiscoverResult; running: boolean; error?: string }>({ running: false });
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set());
  const [workspaceError, setWorkspaceError] = useState<string>();
  const [saved, setSaved] = useState<{ rootsAdded: string[]; tracked: number }>({ rootsAdded: [], tracked: 0 });
  const discoverySeq = useRef(0);

  // Agents.
  const [availability, setAvailability] = useState<{ agents: AgentAvailability[]; presets: AgentAvailability[] }>();
  const [enable, setEnable] = useState(false);
  const [agentId, setAgentId] = useState<string>();
  const [agentsError, setAgentsError] = useState<string>();

  // System check.
  const [report, setReport] = useState<EnvironmentReport>();
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState<string>();

  useEffect(() => {
    api.setup().then(setInfo, () => undefined);
    api.sessions().then(
      (s) => setAvailability({ agents: s.agents, presets: s.presets }),
      () => setAvailability({ agents: [], presets: [] }),
    );
  }, []);

  // The step's heading takes focus, so a screen reader announces where the user is and Tab starts in the step.
  useEffect(() => heading.current?.focus(), [step]);

  const configuredRoots = config?.scanRoots ?? [];
  const missing = new Map((discovery.result?.errors ?? []).filter((e) => entered.includes(e.root)).map((e) => [e.root, e.message]));

  // Discovery over the configured and entered roots, without saving; only the latest run's result is shown.
  const rootsKey = JSON.stringify([configuredRoots, entered]);
  useEffect(() => {
    const roots = [...configuredRoots, ...entered.filter((r) => !configuredRoots.includes(r))];
    const mine = ++discoverySeq.current;
    if (roots.length === 0) {
      setDiscovery({ running: false });
      return;
    }
    setDiscovery((was) => ({ ...was, running: true }));
    api.discover(roots, config?.ignorePaths ?? []).then(
      (result) => mine === discoverySeq.current && setDiscovery({ result, running: false }),
      (err) => mine === discoverySeq.current && setDiscovery({ running: false, error: message(err) }),
    );
  }, [rootsKey]);

  const choices = config && availability ? agentChoices(config, availability.agents, availability.presets) : [];
  // Preselected once the choices are known; the user's choice wins from then on.
  useEffect(() => {
    if (agentId === undefined && config && availability) setAgentId(preselectedAgent(config, choices));
  }, [config, availability]);
  const savedEnabled = config?.agentSessions.enabled === true;
  const chosenAgent = agentId ?? config?.agentSessions.defaultAgent ?? "";

  /** Something entered on the current step that its Continue has not saved. */
  const dirty =
    (step === 1 && (entered.length > 0 || input.trim() !== "")) ||
    (step === 2 && config !== null && agentsSave(config, { enable, agentId: chosenAgent }) !== null);

  const loadReport = useCallback(async () => {
    setChecking(true);
    try {
      setReport(await api.environment(true));
      setCheckError(undefined);
    } catch (err) {
      setCheckError(message(err));
    } finally {
      setChecking(false);
    }
  }, []);
  useEffect(() => {
    if (step === 3) void loadReport();
  }, [step, loadReport]);

  const finish = useCallback(async () => {
    let done = false;
    try {
      onSaved(await api.markSetupDone());
      done = true;
    } catch {
      // Closed anyway: setup is still pending and the wizard opens again on the next load.
    }
    onClose(done);
  }, [onSaved, onClose]);

  const requestSkip = useCallback(() => {
    if (dirty) setConfirmingSkip(true);
    else void finish();
  }, [dirty, finish]);

  // Escape acts as Skip setup — after a confirmation when something entered would be lost — and, while that
  // confirmation shows, as Keep going.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || busy) return;
      e.stopPropagation();
      if (confirmingSkip) setConfirmingSkip(false);
      else requestSkip();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [busy, confirmingSkip, requestSkip]);

  const addRoot = (text: string) => {
    if (!text.trim()) return;
    if (!isAbsoluteRoot(text)) {
      setInputError("Enter a full path, such as ~/Workspace or /srv/projects.");
      return;
    }
    const root = expandHome(text, info?.home ?? "~");
    setInputError(undefined);
    setInput("");
    if (!entered.includes(root) && !configuredRoots.includes(root)) setEntered([...entered, root]);
  };

  const continueWorkspace = async () => {
    setBusy(true);
    setWorkspaceError(undefined);
    try {
      const fresh = await api.config();
      const next = workspaceSave(fresh, entered, new Set(missing.keys()));
      let current = fresh;
      if (next) {
        current = await api.saveConfig(next);
        onSaved(current);
      }
      const added = next ? next.scanRoots.filter((r) => !fresh.scanRoots.includes(r)) : [];
      let tracked = 0;
      for (const candidate of discovery.result?.candidates ?? []) {
        if (unchecked.has(candidate.path)) continue;
        current = await api.trackRepo(candidate.path);
        tracked++;
      }
      if (tracked > 0) onSaved(current);
      setSaved((was) => ({ rootsAdded: [...was.rootsAdded, ...added], tracked: was.tracked + tracked }));
      setEntered([]);
      setUnchecked(new Set());
      setStep(2);
    } catch (err) {
      setWorkspaceError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const continueAgents = async () => {
    setBusy(true);
    setAgentsError(undefined);
    try {
      const next = agentsSave(await api.config(), { enable, agentId: chosenAgent });
      if (next) onSaved(await api.saveConfig(next));
      setStep(3);
    } catch (err) {
      setAgentsError(message(err));
    } finally {
      setBusy(false);
    }
  };

  const frame = {
    step,
    busy,
    headingRef: heading,
    onBack: step > 0 ? () => setStep(step - 1) : undefined,
    onSkip: step < SETUP_STEPS.length - 1 ? requestSkip : undefined,
    confirmingSkip,
    onConfirmSkip: () => void finish(),
    onCancelSkip: () => setConfirmingSkip(false),
  };

  if (step === 0) {
    return (
      <WizardFrame {...frame} onContinue={() => setStep(1)}>
        <WelcomeStep />
      </WizardFrame>
    );
  }
  if (step === 1) {
    const view: WorkspaceView = {
      configuredRoots,
      entered,
      missing,
      suggestions: (info?.suggestedRoots ?? []).filter((s) => !entered.includes(s) && !configuredRoots.includes(s)),
      input,
      inputError,
      discovery: discovery.result,
      discovering: discovery.running,
      discoveryError: discovery.error,
      unchecked,
      saveError: workspaceError,
    };
    return (
      <WizardFrame {...frame} onContinue={() => void continueWorkspace()}>
        <WorkspaceStep
          view={view}
          onInput={setInput}
          onAdd={addRoot}
          onRemove={(root) => setEntered(entered.filter((r) => r !== root))}
          onToggle={(path) => {
            const next = new Set(unchecked);
            if (next.has(path)) next.delete(path);
            else next.add(path);
            setUnchecked(next);
          }}
        />
      </WizardFrame>
    );
  }
  if (step === 2) {
    const chosen = choices.find((c) => c.id === chosenAgent);
    const profile = config?.agentSessions.agents.find((a) => a.id === chosenAgent);
    const view: AgentsView = {
      savedEnabled,
      enable: savedEnabled || enable,
      choices,
      agentId: chosenAgent,
      install: chosen && !chosen.available ? agentInstallSteps(profile ?? { id: chosen.id, name: chosen.name, command: [chosen.id] }, info?.platform ?? "linux") : undefined,
      saveError: agentsError,
    };
    return (
      <WizardFrame {...frame} onContinue={() => void continueAgents()}>
        <AgentsStep view={view} onEnable={setEnable} onChoose={setAgentId} />
      </WizardFrame>
    );
  }
  if (step === 3) {
    return (
      <WizardFrame {...frame} onContinue={() => setStep(4)}>
        <SystemCheckStep report={report} loading={checking} error={checkError} onRecheck={() => void loadReport()} />
      </WizardFrame>
    );
  }
  return (
    <WizardFrame {...frame} onContinue={() => void finish()} continueLabel="Finish">
      <DoneStep summary={setupSummary(config, saved, report)} />
    </WizardFrame>
  );
}
