'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import DataCard from '@/components/layout/data-card'
import { useDrillHeaderTitle } from './settings-drill'

type SettingsCardProps = {
  title?: string
  description?: string
  id?: string
  children: ReactNode
  className?: string
  /** Classes for the body under the title (default stacks children in a column). */
  bodyClassName?: string
  /** Card actions under the body, right-aligned like every card footer. */
  footer?: ReactNode
}

/**
 * A settings card: a `DataCard` (the one card, so settings titles, padding and spacing match
 * every other page) with the card title and a help line over its rows. Inside an open settings
 * row whose page header already names it, a title that repeats the header is left out (the help
 * line stays), so the screen has one heading.
 */
export default function SettingsCard({
  title,
  description,
  id,
  children,
  className,
  bodyClassName,
  footer,
}: SettingsCardProps) {
  // Hooks
  const headerTitle = useDrillHeaderTitle()

  // Render logic
  const heading = title && title !== headerTitle ? title : undefined

  return (
    <DataCard
      id={id}
      title={heading}
      subtitle={description}
      footer={footer}
      className={cn('h-auto scroll-mt-6', className)}
      bodyClassName={cn('flex flex-col', bodyClassName)}
    >
      {children}
    </DataCard>
  )
}
