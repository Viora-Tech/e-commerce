'use client'

import type { ReactNode } from 'react'
import { useActiveSection } from './section-tabs'

type SettingsSectionProps = {
  id: string
  children: ReactNode
  className?: string
}

/** One tab panel of a settings page; renders only while its tab is active. */
export default function SettingsSection({ id, children, className }: SettingsSectionProps) {
  // Hooks
  const active = useActiveSection()

  // Early returns
  if (active !== null && active !== id) return null

  // Render logic
  return (
    <section id={id} role="tabpanel" className={className}>
      {children}
    </section>
  )
}
