'use client'

import { loginContent } from '@/data/login'
import { useCopy } from '@/hooks/use-copy'

/** Phone-width stand-in for the brand panel: a short gradient band with the first headline. */
export default function LoginPanelCompact() {
  // Hooks
  const { panel } = useCopy(loginContent)
  const first = panel.slides[0]

  return (
    <div className="flex flex-col gap-1 bg-gradient-to-br from-primary-tint via-primary-soft to-primary/30 px-6 py-6 lg:hidden">
      <h2 className="font-display text-kit-heading text-ink-strong">{first.title}</h2>
      <p className="text-body text-helper">{first.body}</p>
    </div>
  )
}
