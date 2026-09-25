import { Info, Lightbulb, Warning, WarningOctagon } from '@phosphor-icons/react/ssr'
import type { ReactNode } from 'react'

type CalloutType = 'default' | 'info' | 'warning' | 'error' | 'important'

type CalloutProps = {
  type?: CalloutType
  emoji?: ReactNode
  children: ReactNode
}

/* Accent for notes and tips, amber for warnings, red for errors. */
const tones = {
  default: { tone: 'accent', Icon: Lightbulb },
  info: { tone: 'accent', Icon: Info },
  important: { tone: 'accent', Icon: Info },
  warning: { tone: 'amber', Icon: Warning },
  error: { tone: 'red', Icon: WarningOctagon },
} as const

/**
 * Drop-in for Nextra's `<Callout>` (same `type`/`emoji` props): a tinted box
 * with a Phosphor icon, registered in mdx-components.tsx.
 */
export default function Callout({ type = 'default', emoji, children }: CalloutProps) {
  const { tone, Icon } = tones[type]

  return (
    <div data-tone={tone} className="docs-callout mt-5 flex gap-3 rounded-lg border px-4 py-3">
      <span
        className="docs-callout-icon mt-0.5 shrink-0"
        data-pagefind-ignore="all"
        aria-hidden="true"
      >
        {emoji ?? <Icon size={18} weight="regular" />}
      </span>
      <div className="min-w-0 flex-1 text-[0.9375rem] [&>:first-child]:mt-0">{children}</div>
    </div>
  )
}
