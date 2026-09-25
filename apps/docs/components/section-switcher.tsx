'use client'

import { CaretUpDown, Code, Storefront } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import type { ChangeEvent } from 'react'
import { type SectionId, sections } from '../data/sections'

type SectionSwitcherProps = {
  current: SectionId
}

const sectionIcons = {
  merchant: Storefront,
  developer: Code,
} as const

/**
 * "Merchant guide ↔ Developers" picker at the top of the sidebar, in the
 * spirit of the router switcher on nextjs.org/docs. A native <select> sits
 * invisibly over the styled face so keyboard, screen readers and mobile
 * pickers all work for free.
 */
export default function SectionSwitcher({ current }: SectionSwitcherProps) {
  const router = useRouter()

  const Icon = sectionIcons[current]
  const active = sections.find((section) => section.id === current) ?? sections[0]

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = sections.find((section) => section.id === event.target.value)
    if (next) router.push(next.href)
  }

  return (
    <span className="docs-switcher relative flex h-9 w-full items-center gap-2 rounded-lg border px-2.5 text-sm font-medium">
      <Icon size={16} weight="light" className="shrink-0 text-(--docs-accent)" aria-hidden="true" />
      <span className="flex-1 truncate">{active.label}</span>
      <CaretUpDown size={14} className="shrink-0 text-(--docs-muted)" aria-hidden="true" />
      <select
        aria-label="Docs section"
        value={current}
        onChange={handleChange}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {sections.map((section) => (
          <option key={section.id} value={section.id}>
            {section.label}
          </option>
        ))}
      </select>
    </span>
  )
}
