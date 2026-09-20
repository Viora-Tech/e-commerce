'use client'

import { Command as CommandPrimitive } from 'cmdk'
import type * as React from 'react'
import { cn } from '../../lib/utils'
import IconComponent from '../global/icon-component'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './dialog'

const Command = ({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) => (
  <CommandPrimitive
    className={cn(
      'flex h-full w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground',
      className,
    )}
    data-slot="command"
    {...props}
  />
)

const CommandDialog = ({
  title = 'Command Palette',
  description = 'Search for a command to run...',
  children,
  className,
  showCloseButton = true,
  shouldFilter = true,
  ...props
}: React.ComponentProps<typeof Dialog> & {
  title?: string
  description?: string
  className?: string
  showCloseButton?: boolean
  shouldFilter?: boolean
}) => (
  <Dialog {...props}>
    <DialogContent
      className={cn(
        'overflow-hidden rounded-xl border border-border bg-secondary/20 p-0 shadow-lg sm:max-w-xl',
        className,
      )}
      showCloseButton={showCloseButton}
    >
      <DialogHeader className="sr-only">
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </DialogHeader>
      <Command
        className="[&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0"
        shouldFilter={shouldFilter}
      >
        {children}
      </Command>
    </DialogContent>
  </Dialog>
)

const CommandInput = ({
  className,
  showEscHint = false,
  isLoading = false,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
  showEscHint?: boolean
  isLoading?: boolean
}) => {
  const iconName = isLoading ? 'Loader2' : 'Search'
  return (
    <div
      className="relative flex h-14 items-center gap-3 border-border border-b px-4"
      data-slot="command-input-wrapper"
    >
      <IconComponent
        className={cn('size-5 shrink-0 text-muted-foreground', isLoading && 'animate-spin')}
        icon={iconName}
      />
      <CommandPrimitive.Input
        className={cn(
          'flex h-12 w-full bg-transparent text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        data-slot="command-input"
        {...props}
      />
      {showEscHint && (
        <kbd className="pointer-events-none hidden h-6 select-none items-center rounded-md border border-border bg-muted px-2 font-medium font-mono text-muted-foreground text-xs md:inline-flex">
          ESC
        </kbd>
      )}
    </div>
  )
}

const CommandList = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.List>) => (
  <CommandPrimitive.List
    className={cn('max-h-80 overflow-y-auto overflow-x-hidden p-3', className)}
    data-slot="command-list"
    {...props}
  />
)

const CommandEmpty = ({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) => (
  <CommandPrimitive.Empty
    className="py-6 text-center text-sm"
    data-slot="command-empty"
    {...props}
  />
)

const CommandGroup = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) => (
  <CommandPrimitive.Group
    className={cn(
      'overflow-hidden text-foreground [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-2 [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide',
      className,
    )}
    data-slot="command-group"
    {...props}
  />
)

const CommandSeparator = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) => (
  <CommandPrimitive.Separator
    className={cn('-mx-1 h-px bg-border', className)}
    data-slot="command-separator"
    {...props}
  />
)

const CommandItem = ({
  className,
  ...props
}: React.ComponentProps<typeof CommandPrimitive.Item>) => (
  <CommandPrimitive.Item
    className={cn(
      'relative flex cursor-pointer select-none items-center gap-3 rounded-xl p-3 text-sm outline-hidden transition-colors',
      'data-[selected=true]:bg-secondary data-[selected=true]:text-foreground',
      "[&_svg:not([class*='text-'])]:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0",
      'data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-50',
      className,
    )}
    data-slot="command-item"
    {...props}
  />
)

const CommandShortcut = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    className={cn('ml-auto text-muted-foreground text-xs tracking-widest', className)}
    data-slot="command-shortcut"
    {...props}
  />
)

export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
}
