'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import CopyField from '@/components/fields/copy-field'
import { sesSetupContent } from '@/data/ses-setup'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Check = Awaited<ReturnType<typeof api.notifications.checkSes>>

type SesSetupCardProps = {
  /** Changes after every Save, so the check runs again on the saved keys. */
  runKey: number
}

type State = { kind: 'checking' } | { kind: 'done'; check: Check } | { kind: 'failed' }

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:4100'

/**
 * Under the SES fields: the after-save connection check (errors block sending, sandbox only
 * warns) and how to send this store's bounces and complaints to its suppression list.
 */
export default function SesSetupCard({ runKey }: SesSetupCardProps) {
  // Hooks
  const copy = useCopy(sesSetupContent)
  const [state, setState] = useState<State>({ kind: 'checking' })
  const [attempt, setAttempt] = useState(0)
  const [storeId, setStoreId] = useState<string | null>(null)
  useEffect(() => {
    api.store
      .current()
      .then((s) => setStoreId(s?.id ?? null))
      .catch(() => undefined)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: runKey and attempt re-run the check
  useEffect(() => {
    let cancelled = false
    setState({ kind: 'checking' })
    api.notifications
      .checkSes()
      .then((check) => !cancelled && setState({ kind: 'done', check }))
      .catch(() => !cancelled && setState({ kind: 'failed' }))
    return () => {
      cancelled = true
    }
  }, [runKey, attempt])

  // Event handlers
  const handleAgain = () => setAttempt((n) => n + 1)

  // Render logic
  const check = state.kind === 'done' ? state.check : null
  const errors = check?.errors ?? []
  const warnings = check?.warnings ?? []
  const headline =
    state.kind === 'checking'
      ? copy.check.checking
      : state.kind === 'failed'
        ? copy.check.failed
        : !check
          ? copy.check.notSaved
          : errors.length > 0
            ? copy.check.blocked
            : warnings.length > 0
              ? copy.check.readyWithLimit
              : copy.check.ready
  const tone =
    errors.length > 0 || state.kind === 'failed'
      ? 'text-destructive'
      : warnings.length > 0
        ? 'text-warning'
        : 'text-foreground'

  return (
    <div className="flex flex-col gap-5 border-t border-border pt-4">
      <section className="flex flex-col gap-2" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <p className="text-body font-medium text-foreground">{copy.check.title}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAgain}
            loading={state.kind === 'checking'}
          >
            {copy.check.again}
          </Button>
        </div>
        <p className={`text-body ${tone}`}>{headline}</p>
        {errors.length + warnings.length > 0 ? (
          <ul className="flex list-disc flex-col gap-1 pl-5 text-body">
            {errors.map((e) => (
              <li key={e} className="text-destructive">
                {copy.check.issues[e]}
              </li>
            ))}
            {warnings.map((w) => (
              <li key={w} className="text-muted-foreground">
                {copy.check.issues[w]}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className="flex flex-col gap-2">
        <p className="text-body font-medium text-foreground">{copy.bounces.title}</p>
        <p className="text-caption text-muted-foreground">{copy.bounces.body}</p>
        <label htmlFor="ses-events-url" className="text-caption text-muted-foreground">
          {copy.bounces.urlLabel}
        </label>
        <CopyField
          id="ses-events-url"
          value={`${WORKER_URL}/webhooks/email/ses/${storeId ?? '<store id>'}`}
        />
      </section>
    </div>
  )
}
