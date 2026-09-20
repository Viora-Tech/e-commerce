export interface WorkflowStep<S> {
  name: string
  run(state: S): Promise<Partial<S>>
  compensate?(state: S): Promise<void>
}

export type WorkflowLog = { error(message: string, err: unknown): void }

const defaultLog: WorkflowLog = {
  error: (message, err) => console.error(message, err),
}

/**
 * Run steps in order, merging each result into `state`. If step N throws,
 * compensations for steps N-1..0 run in reverse; each compensation error is
 * logged and swallowed; the original error is rethrown.
 */
export async function runWorkflow<S>(
  state: S,
  steps: WorkflowStep<S>[],
  log: WorkflowLog = defaultLog,
): Promise<S> {
  const completed: WorkflowStep<S>[] = []
  for (const step of steps) {
    try {
      const patch = await step.run(state)
      Object.assign(state as object, patch)
      completed.push(step)
    } catch (err) {
      for (const done of completed.reverse()) {
        if (!done.compensate) continue
        try {
          await done.compensate(state)
        } catch (compErr) {
          log.error(`compensation failed: ${done.name}`, compErr)
        }
      }
      throw err
    }
  }
  return state
}
