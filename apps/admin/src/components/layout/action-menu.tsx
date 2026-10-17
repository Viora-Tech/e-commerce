'use client'

import { ChevronDown, type IconComponent, MoreHorizontal, MoreVertical } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { Fragment, type ReactElement } from 'react'

export type ActionItem = {
  label: string
  /** A 16px lead icon (Figma row menu). */
  icon?: IconComponent | undefined
  /** Makes the item a link: `Link` for in-app paths, a plain anchor otherwise. */
  href?: string | undefined
  /** Opens in a new browser tab. */
  newTab?: boolean | undefined
  onSelect?: (() => void) | undefined
  destructive?: boolean | undefined
  disabled?: boolean | undefined
  /** Drops the item without the caller building a filtered array. */
  hidden?: boolean | undefined
  /** A rule above this item; destructive items get one automatically. */
  separatorBefore?: boolean | undefined
}

type ActionMenuProps = {
  /** The trigger's aria-label, and its visible text for the `button` trigger. */
  label: string
  trigger?: 'kebab' | 'kebab-vertical' | 'button'
  /** `sm` is the 7x7 row/card kebab, `md` the 8x8 one. */
  size?: 'sm' | 'md'
  /** Kebabs sit in clickable rows, so their events stay in the menu by default. */
  stopPropagation?: boolean
  align?: 'start' | 'end'
  items: readonly ActionItem[]
  /** `plain` is the bare kebab (hover tint); `bare` takes only `triggerClassName`. */
  variant?: 'plain' | 'ghost' | 'outline' | 'key-neutral' | 'default' | 'bare'
  disabled?: boolean
  /** Swaps the trigger's glyph for a spinner while work is running. */
  loading?: boolean
  triggerClassName?: string
  contentClassName?: string
}

const PLAIN =
  'flex shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50'

function stop(e: { stopPropagation: () => void }) {
  e.stopPropagation()
}

function linkFor(item: ActionItem): ReactElement | undefined {
  const href = item.href
  if (!href) return undefined
  if (item.newTab || !href.startsWith('/')) {
    return <a href={href} {...(item.newTab ? { target: '_blank', rel: 'noreferrer' } : {})} />
  }
  return <Link href={href} />
}

/**
 * The one ⋯ menu: row kebabs, card kebabs and header "More" buttons. Confirm dialogs stay
 * with the caller, which opens its own from `onSelect`.
 */
export default function ActionMenu({
  label,
  trigger = 'kebab',
  size = 'sm',
  stopPropagation = trigger !== 'button',
  align = 'end',
  items,
  variant,
  disabled,
  loading,
  triggerClassName,
  contentClassName,
}: ActionMenuProps) {
  // Helpers
  const guard = stopPropagation ? stop : undefined

  // Early returns
  if (items.every((item) => item.hidden)) return null

  // Render logic
  const visible = items.filter((item) => !item.hidden)
  const firstDestructive = visible.findIndex((item) => item.destructive)
  const Glyph = trigger === 'kebab' ? MoreHorizontal : MoreVertical
  const glyph = loading ? <Spinner /> : <Glyph className="size-4" aria-hidden />

  const triggerEvents = { onClick: guard, onKeyDown: guard }
  const kebabVariant = variant ?? 'plain'

  return (
    <DropdownMenu>
      {trigger === 'button' ? (
        <DropdownMenuTrigger
          render={
            <Button
              variant={variant === 'key-neutral' || variant === 'default' ? variant : 'outline'}
              {...triggerEvents}
            />
          }
          disabled={disabled}
          className={triggerClassName}
        >
          {label}
          <ChevronDown aria-hidden />
        </DropdownMenuTrigger>
      ) : kebabVariant === 'plain' || kebabVariant === 'bare' ? (
        <DropdownMenuTrigger
          aria-label={label}
          disabled={disabled}
          {...triggerEvents}
          className={cn(
            kebabVariant === 'plain' && [PLAIN, size === 'sm' ? 'size-7' : 'size-8'],
            triggerClassName,
          )}
        >
          {glyph}
        </DropdownMenuTrigger>
      ) : (
        <DropdownMenuTrigger
          render={
            <Button
              variant={kebabVariant}
              size={size === 'sm' ? 'icon-sm' : 'icon'}
              aria-label={label}
              title={label}
              {...triggerEvents}
            />
          }
          disabled={disabled}
          className={triggerClassName}
        >
          {glyph}
        </DropdownMenuTrigger>
      )}
      <DropdownMenuContent
        align={align}
        className={cn('min-w-48', contentClassName)}
        onClick={guard}
      >
        {visible.map((item, i) => {
          const rule = item.separatorBefore || (i === firstDestructive && i > 0)
          const render = linkFor(item)
          return (
            <Fragment key={`${item.label}:${item.href ?? ''}`}>
              {rule ? <DropdownMenuSeparator /> : null}
              <DropdownMenuItem
                variant={item.destructive ? 'destructive' : 'default'}
                disabled={item.disabled}
                onClick={item.onSelect}
                {...(render ? { render } : {})}
              >
                {item.icon ? (
                  <item.icon
                    className={cn('size-4', !item.destructive && 'text-muted-foreground')}
                    aria-hidden
                  />
                ) : null}
                {item.label}
              </DropdownMenuItem>
            </Fragment>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
