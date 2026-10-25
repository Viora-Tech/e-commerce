'use client'

import { QUERY_TABLE_NAMES, QUERY_TABLES, type QueryTable } from '@commerce/core/analytics-query'
import { ChevronRight, Database } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

type QuerySchemaPanelProps = {
  /** Opened first: the table the query reads. */
  table: QueryTable
  onInsert: (name: string) => void
}

/** Figma "Data you can query" (the side panel's reference tab): every table and field; a click inserts it. */
export default function QuerySchemaPanel({ table, onInsert }: QuerySchemaPanelProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query)
  const [open, setOpen] = useState<QueryTable | null>(table)

  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-eyebrow text-muted-foreground">{copy.schemaHeading}</h3>
      <ul className="flex flex-col">
        {QUERY_TABLE_NAMES.map((name) => (
          <li key={name}>
            <button
              type="button"
              aria-expanded={open === name}
              onClick={() => setOpen(open === name ? null : name)}
              className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1 text-body hover:bg-muted"
            >
              <ChevronRight
                className={cn('size-3.5 transition-transform', open === name && 'rotate-90')}
                aria-hidden="true"
              />
              <Database className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="font-mono">{name}</span>
            </button>
            {open === name ? (
              <ul className="mb-1 ml-6 flex flex-col">
                {QUERY_TABLES[name].fields.map((f) => (
                  <li key={f.name}>
                    <button
                      type="button"
                      title={f.description}
                      onClick={() => onInsert(f.name)}
                      className="flex w-full items-baseline justify-between gap-2 rounded-sm px-1.5 py-0.5 text-left hover:bg-muted"
                    >
                      <span className="truncate font-mono text-caption text-info">{f.name}</span>
                      <span className="shrink-0 text-caption text-muted-foreground">
                        {copy.types[f.type]}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="text-caption text-muted-foreground">{copy.schemaHelp}</p>
    </div>
  )
}
