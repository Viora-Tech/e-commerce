import type { ReactNode } from 'react'
import { ACCOUNT_INTRO, ACCOUNT_TITLE } from '@/lib/account-classes'

type AccountPageHeadProps = {
  title: string
  /** One line on what the page is for. */
  intro?: string
  /** A page action beside the title on wide screens, under it on a phone ("Add address"). */
  action?: ReactNode
}

/** The top of a signed-in account page: the title, an optional line under it and an action. */
export default function AccountPageHead({ title, intro, action }: AccountPageHeadProps) {
  // Render logic
  return (
    <header className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h1 className={ACCOUNT_TITLE}>{title}</h1>
        {intro ? <p className={ACCOUNT_INTRO}>{intro}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  )
}
