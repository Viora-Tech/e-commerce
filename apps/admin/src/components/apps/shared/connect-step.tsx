/**
 * SOURCE OF TRUTH KEYWORDS: ConnectStep, Step
 * WHAT:  one numbered step of a provider app's Connect guide, turning into a green tick when done.
 * WHY:   one owner instead of a private Step copied into every courier and Decentro guide.
 * WHERE: CourierConnectGuide and the Decentro ConnectGuide.
 */
import { CheckIcon } from '@commerce/ui/icons'
import type { ReactNode } from 'react'

type ConnectStepProps = { n: number; title: string; done: boolean; children: ReactNode }

export default function ConnectStep({ n, title, done, children }: ConnectStepProps) {
  return (
    <li className="flex gap-3">
      <span
        aria-hidden="true"
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-card text-caption font-semibold text-muted-foreground data-[done=true]:border-transparent data-[done=true]:bg-success-soft data-[done=true]:text-success"
        data-done={done}
      >
        {done ? <CheckIcon aria-hidden="true" className="size-3.5" /> : n}
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-body font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </li>
  )
}
