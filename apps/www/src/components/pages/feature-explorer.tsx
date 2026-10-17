'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Fragment, useState } from 'react'
import { featuresContent as copy, type FeatureModule } from '@/data/features'
import ChoiceChip from '../common/choice-chip'
import PageContainer from '../common/page-container'
import FeatureDetail from './feature-detail'
import { FEATURE_ICONS } from './feature-icons'

const COLUMNS = 4

type Filter = 'all' | FeatureModule['group']

export default function FeatureExplorer() {
  // Hooks
  const [filter, setFilter] = useState<Filter>('all')
  const [selectedKey, setSelectedKey] = useState('orders')

  // Render logic
  const visible = copy.modules.filter((module) => filter === 'all' || module.group === filter)
  const selected = visible.find((module) => module.key === selectedKey) ?? visible[0]
  const selectedIndex = selected ? visible.indexOf(selected) : -1
  // On wide screens the panel sits under the row that holds the selected module.
  const rowEnd =
    selectedIndex < 0
      ? -1
      : Math.min(visible.length, (Math.floor(selectedIndex / COLUMNS) + 1) * COLUMNS) - 1

  return (
    <PageContainer className="flex flex-col gap-10">
      <fieldset
        aria-label={copy.filterLabel}
        className="m-0 min-w-0 border-0 p-0 flex flex-wrap justify-center gap-2"
      >
        {copy.filters.map((item) => (
          <ChoiceChip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onSelect={() => setFilter(item.key as Filter)}
          />
        ))}
      </fieldset>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {visible.map((module, index) => {
          const Icon = FEATURE_ICONS[module.key] ?? FEATURE_ICONS.orders
          const isSelected = module.key === selected?.key
          return (
            <Fragment key={module.key}>
              <li>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedKey(module.key)}
                  className={cn(
                    'surface-card card-lift flex h-full w-full flex-col items-start gap-3 rounded-2xl p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                    isSelected && 'ring-1 ring-foreground',
                  )}
                >
                  {Icon ? (
                    <span className="grid size-9 place-items-center rounded-lg border border-border bg-muted">
                      <Icon aria-hidden className="size-4" />
                    </span>
                  ) : null}
                  <span className="text-lg font-semibold text-foreground">{module.title}</span>
                  <span className="text-sm text-muted-foreground">{module.summary}</span>
                </button>
              </li>
              {selected && isSelected ? (
                <li className="sm:col-span-2 lg:hidden">
                  <FeatureDetail module={selected} />
                </li>
              ) : null}
              {selected && index === rowEnd ? (
                <li className="hidden lg:col-span-4 lg:block">
                  <FeatureDetail module={selected} />
                </li>
              ) : null}
            </Fragment>
          )
        })}
      </ul>
    </PageContainer>
  )
}
