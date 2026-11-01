'use client'

import type { ReactNode } from 'react'
import { useDrillOpen } from './settings-drill'

type SettingsDrillPanelProps = {
  id: string
  children: ReactNode
  className?: string
}

/** One row's detail in a `SettingsDrill`; renders only while that row is open. */
export default function SettingsDrillPanel({ id, children, className }: SettingsDrillPanelProps) {
  // Hooks
  const open = useDrillOpen(id)

  // Early returns
  if (!open) return null

  // Render logic
  return (
    <div id={`drill-${id}`} className={className ?? 'flex flex-col gap-4'}>
      {children}
    </div>
  )
}
