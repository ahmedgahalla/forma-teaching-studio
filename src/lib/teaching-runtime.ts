import { parseTeachingPlan, validateTeachingPlan, type TeachingContext, type TeachingPlan } from './classroom';
import type { TeachingAction } from './lecture';

export type RuntimeState = { phase: 'idle' | 'interpreting' | 'executing' | 'speaking'; message: string; error: boolean; transcript: string };
export type TeachingHost<S> = {
  context(): TeachingContext; capture(): S; restore(snapshot: S): void;
  preflight(actions: TeachingAction[], fromSnapshot?: S): void; apply(action: TeachingAction, signal?: AbortSignal): void | Promise<void>;
  settle?(signal: AbortSignal): Promise<void>;
  pause(): void; narration(target: 'step' | 'answer' | 'mechanics'): string;
  speak(text: string, signal: AbortSignal): Promise<void>;
  interpret(text: string, context: TeachingContext, signal: AbortSignal): Promise<unknown>;
  publish(state: RuntimeState): void;
};
export function createTeachingRuntime<S>(host: TeachingHost<S>) {
  let token = 0, controller: AbortController | null = null, disposed = false;
  let state: RuntimeState = { phase: 'idle', message: 'Hold Space to speak, or type an instruction.', error: false, transcript: '' };
  type Entry = { before: S; replayStart: S; replaySpeed?: 0.5 | 1 | 2; after?: S; actions: TeachingAction[]; label: string; completed: boolean };
  const past: Entry[] = [], future: Entry[] = [];
  let last: Entry | undefined, activeEntry: Entry | undefined;
  const publish = (patch: Partial<RuntimeState>) => { state = { ...state, ...patch }; if (!disposed) host.publish(state); };
  const interrupt = () => {
    token++; controller?.abort(); controller = null; host.pause();
    // Redo restores the actually observed partial result, never unexecuted actions.
    if (activeEntry) { activeEntry.after = host.capture(); activeEntry = undefined; }
  };
  const cancel = (message = 'Stopped. You can undo the request or give another instruction.') => {
    if (disposed) return;
    interrupt(); publish({ phase: 'idle', message, error: false });
  };
  const abortable = <T>(task: Promise<T>, signal: AbortSignal) => new Promise<T | undefined>((resolve, reject) => {
    const canceled = () => { signal.removeEventListener('abort', canceled); resolve(undefined); };
    if (signal.aborted) { task.catch(() => {}); resolve(undefined); return; }
    signal.addEventListener('abort', canceled, { once: true });
    task.then(value => { signal.removeEventListener('abort', canceled); resolve(value); }, error => { signal.removeEventListener('abort', canceled); if (signal.aborted) resolve(undefined); else reject(error); });
  });
  const waitForPlayback = async (signal: AbortSignal) => {
    while (host.context().playing && !signal.aborted) await new Promise<void>(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
      const timer = setTimeout(done, 30); signal.addEventListener('abort', done, { once: true });
      if (signal.aborted) done();
    });
  };
  const run = async (plan: TeachingPlan, own: number, signal: AbortSignal, before?: S, preflightDone = false, replayStart?: S, replaySpeed?: 0.5 | 1 | 2, expectedRevision?: number): Promise<void> => {
    if (plan.clarification) { publish({ phase: 'idle', message: plan.clarification, error: true }); return; }
    const first = plan.actions[0];
    if (first?.kind === 'stop' && plan.actions.length === 1) { cancel(); return; }
    if (host.settle && !preflightDone) await abortable(host.settle(signal), signal);
    if (signal.aborted || own !== token) return;
    if (expectedRevision !== undefined && host.context().revision !== expectedRevision) throw new Error('The teaching context changed. Repeat the request for the current scene.');
    if (first?.kind === 'history' || first?.kind === 'dental' && (first.command.type === 'undo' || first.command.type === 'redo')) {
      host.pause();
      const redo = first.kind === 'history' ? first.action === 'redo' : first.command.type === 'redo';
      const count = first.kind === 'history' ? first.count : 1, source = redo ? future : past;
      if (first.kind === 'history' && source.length < count) throw new Error(`Only ${source.length} complete requests are available to ${redo ? 'redo' : 'undo'}; nothing was changed.`);
      if (!source.length) {
        if (host.context().mode === 'case' && first.kind === 'dental') { host.preflight([first]); await abortable(Promise.resolve(host.apply(first, signal)), signal); if (signal.aborted || own !== token) return; publish({ phase: 'idle', message: `${redo ? 'Redo' : 'Undo'} applied to the case movement history.`, error: false }); }
        else publish({ phase: 'idle', message: `Nothing to ${redo ? 'redo' : 'undo'} in the command history.`, error: false });
        return;
      }
      const entries = source.slice(-count).reverse(), entry = entries[entries.length - 1];
      if (redo && entry.after !== undefined) host.restore(entry.after); else host.restore(entry.before);
      source.splice(-count); (redo ? past : future).push(...entries); last = past.findLast(item => item.completed);
      publish({ phase: 'idle', message: count === 1 ? `${redo ? 'Restored' : 'Undid'} the whole request: ${entry.label}` : `${redo ? 'Restored' : 'Undid'} ${count} complete requests.`, error: false }); return;
    }
    if (first?.kind === 'replay') {
      const previous = last;
      if (previous) {
        const current = host.capture();
        const speed = first.slower ? 0.5 : previous.replaySpeed;
        const actions: TeachingAction[] = previous.actions.map(action => speed !== undefined && action.kind === 'speed' ? { kind: 'speed', value: speed } : action);
        host.preflight(actions, previous.replayStart);
        if (speed !== undefined) host.preflight([{ kind: 'speed', value: speed }], previous.replayStart);
        host.restore(previous.replayStart);
        await run({ actions, summary: `Repeat: ${previous.label}`, clarification: null }, own, signal, current, true, previous.replayStart, speed); return;
      }
      plan = { ...plan, actions: [...(first.slower ? [{ kind: 'speed', value: .5 } as TeachingAction] : []), { kind: 'workflow', action: 'play' }] };
    }
    if (!preflightDone) host.preflight(plan.actions);
    const previousFuture = [...future];
    const start = before ?? host.capture();
    const entry: Entry = { before: start, replayStart: replayStart ?? start, replaySpeed, actions: plan.actions, label: plan.summary || state.transcript, completed: false };
    activeEntry = entry;
    past.push(entry); if (past.length > 50) past.shift(); future.length = 0;
    publish({ phase: 'executing', message: plan.summary || 'Running your instruction.', error: false });
    const overrides: TeachingAction[] = [];
    try {
      // Replay speed is execution metadata, not a ninth action in an eight-action request.
      if (replaySpeed !== undefined) { const speed: TeachingAction = { kind: 'speed', value: replaySpeed }; await abortable(Promise.resolve(host.apply(speed, signal)), signal); overrides.push(speed); }
      for (const action of plan.actions) {
        if (signal.aborted || own !== token) return;
        if (action.kind === 'narrate' || action.kind === 'mechanics' && action.action.type === 'explain') {
          const text = host.narration(action.kind === 'narrate' ? action.target : 'mechanics');
          publish({ phase: 'speaking', message: text }); await abortable(host.speak(text, signal), signal);
        } else {
          const applied = host.apply(action, signal);
          if (applied) await abortable(applied, signal);
          if (signal.aborted || own !== token) return;
          if (['select', 'view', 'arch', 'toggle', 'anatomy', 'speed'].includes(action.kind)) overrides.push(action);
          // A guided step has useful defaults, but explicit directions in this request win.
          if ((action.kind === 'workflow' && ['start', 'play'].includes(action.action)) || (action.kind === 'dental' && action.command.type === 'play')) for (const override of overrides) {
            const reapplied = host.apply(override, signal);
            if (reapplied) await abortable(reapplied, signal);
            if (signal.aborted || own !== token) return;
          }
          await waitForPlayback(signal);
        }
      }
      if (host.settle) await abortable(host.settle(signal), signal);
      if (signal.aborted || own !== token) return;
      entry.after = host.capture(); entry.completed = true; activeEntry = undefined; last = entry;
      publish({ phase: 'idle', message: plan.summary || 'Instruction complete.', error: false });
    } catch (error) {
      if (signal.aborted || own !== token) return;
      host.restore(entry.before); past.pop(); future.splice(0, future.length, ...previousFuture); activeEntry = undefined; throw error;
    }
  };
  const submit = async (text: string) => {
    if (disposed || !text.trim()) return;
    if (/^(stop|cancel|pause everything)$/i.test(text.trim())) { cancel(); return; }
    interrupt(); const own = token;
    controller = new AbortController(); const signal = controller.signal;
    const context = { ...host.context(), lastActions: last?.actions }, revision = context.revision;
    publish({ phase: 'interpreting', transcript: text, message: 'Understanding your instruction…', error: false });
    try {
      let plan: TeachingPlan;
      try { plan = parseTeachingPlan(text, context); }
      catch { const response = await abortable(host.interpret(text, context, signal), signal); if (signal.aborted || own !== token) return; plan = validateTeachingPlan(response, { ...host.context(), lastActions: last?.actions }, { sourceText: text, expectedRevision: revision }); }
      if (signal.aborted || own !== token || host.context().revision !== revision) return;
      await run(plan, own, signal, undefined, false, undefined, undefined, revision);
    } catch (error) { if (own === token && !signal.aborted) publish({ phase: 'idle', message: error instanceof Error ? error.message : 'Could not run that instruction.', error: true }); }
  };
  const submitActions = async (actions: TeachingAction[], summary: string) => {
    if (disposed) return;
    interrupt(); const own = token;
    controller = new AbortController(); const signal = controller.signal;
    publish({ phase: 'interpreting', transcript: summary, message: 'Checking the instruction…', error: false });
    try {
      const context = { ...host.context(), lastActions: last?.actions };
      const plan = validateTeachingPlan({ actions, summary, clarification: null }, context, { allowLocalActions: true });
      if (signal.aborted || own !== token) return;
      await run(plan, own, signal, undefined, false, undefined, undefined, context.revision);
    } catch (error) { if (own === token && !signal.aborted) publish({ phase: 'idle', message: error instanceof Error ? error.message : 'Could not run that instruction.', error: true }); }
  };
  return { submit, submitActions, cancel, getState: () => ({ ...state }), getLastActions: () => last?.actions, clearHistory() { cancel('Command history cleared.'); past.length = 0; future.length = 0; last = undefined; }, dispose() { if (disposed) return; disposed = true; interrupt(); } };
}
