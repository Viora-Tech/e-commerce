'use client'

import { ChevronDown, Copy, MoreHorizontal, Trash2 } from '@commerce/ui/icons'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@commerce/ui/shadcn/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { AutoField, type Field } from '@puckeditor/core'
import Image from 'next/image'
import type { ReactNode } from 'react'
import { customizeContent } from '@/data/customize'

type CustomizeArrayItemProps = {
  item: Record<string, unknown>
  title: string
  thumbnail: string | undefined
  arrayFields: Record<string, Field>
  handle: ReactNode
  canDuplicate: boolean
  canDelete: boolean
  readOnly?: boolean
  onUpdate: (key: string, value: unknown) => void
  onDuplicate: () => void
  onDelete: () => void
}

const copy = customizeContent.array

/** One card in a Customize array field: a Hero slide, a logo, an FAQ entry. */
export default function CustomizeArrayItem({
  item,
  title,
  thumbnail,
  arrayFields,
  handle,
  canDuplicate,
  canDelete,
  readOnly,
  onUpdate,
  onDuplicate,
  onDelete,
}: CustomizeArrayItemProps) {
  // Render logic
  const keys = Object.keys(arrayFields)
  const showMenu = canDuplicate || canDelete

  return (
    <Collapsible className="rounded-lg border border-border bg-card">
      <div className="flex min-h-10 items-center gap-2 px-1.5 py-1">
        {handle}
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            width={32}
            height={32}
            className="size-8 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <CollapsibleTrigger className="group flex min-w-0 flex-1 items-center gap-1.5 text-left">
          <span className="truncate text-[0.8125rem] leading-5 font-medium text-foreground">
            {title}
          </span>
          <ChevronDown
            aria-hidden
            className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        {showMenu ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  aria-label={copy.more(title)}
                  title={copy.more(title)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:outline-none motion-reduce:transition-none"
                >
                  <MoreHorizontal aria-hidden className="size-4" />
                </button>
              }
            />
            <DropdownMenuContent align="end">
              {canDuplicate ? (
                <DropdownMenuItem onClick={onDuplicate}>
                  <Copy aria-hidden />
                  {copy.duplicate(title)}
                </DropdownMenuItem>
              ) : null}
              {canDelete ? (
                <DropdownMenuItem variant="destructive" onClick={onDelete}>
                  <Trash2 aria-hidden />
                  {copy.remove(title)}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 border-t border-border px-3 py-3">
          {keys.map((key) => (
            <AutoField
              key={key}
              field={arrayFields[key] as NonNullable<(typeof arrayFields)[string]>}
              value={item[key]}
              readOnly={readOnly}
              onChange={(value: unknown) => onUpdate(key, value)}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
