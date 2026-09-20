'use client'

import IconComponent from '@commerce/ui/global/icon-component'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { useEffect, useRef, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'

type AdminSearchInputProps = {
  value: string
  onDebouncedChange: (value: string) => void
  placeholder?: string
  className?: string
}

export function AdminSearchInput({
  value,
  onDebouncedChange,
  placeholder = 'Search...',
  className,
}: AdminSearchInputProps) {
  const onDebouncedChangeRef = useRef(onDebouncedChange)
  const [typedValue, setTypedValue] = useState<string | null>(null)
  const searchTerm = typedValue ?? value

  useEffect(() => {
    onDebouncedChangeRef.current = onDebouncedChange
  }, [onDebouncedChange])

  const debouncedSearchTerm = useDebounce(searchTerm, 400)
  const isPending = searchTerm !== debouncedSearchTerm

  useEffect(() => {
    if (debouncedSearchTerm !== searchTerm) return

    const nextValue = debouncedSearchTerm.trim()
    if (nextValue !== value) {
      onDebouncedChangeRef.current(nextValue)
    }
  }, [debouncedSearchTerm, searchTerm, value])

  const hasQuery = searchTerm.trim().length > 0

  const handleClear = () => {
    setTypedValue('')
    onDebouncedChangeRef.current('')
  }

  return (
    <div
      className={cn(
        'flex h-10 w-117 max-w-full shrink-0 flex-none items-center gap-2 rounded-xl bg-secondary/40 px-3 transition-colors focus-within:bg-secondary/60 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary/35',
        className,
      )}
    >
      <IconComponent
        className={cn('size-4 shrink-0 opacity-50', isPending && 'animate-spin')}
        icon={isPending ? 'Loader2' : 'Search'}
      />
      <Input
        className="h-full min-w-0 flex-1 border-none bg-transparent! px-0 shadow-none outline-none focus-visible:ring-0"
        onChange={(e) => setTypedValue(e.target.value)}
        placeholder={placeholder}
        type="text"
        value={searchTerm}
      />
      {hasQuery ? (
        <Button
          aria-label="Clear search"
          className="-mr-1 size-7 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-background/60 hover:text-foreground"
          size="icon"
          type="button"
          variant="ghost"
          onClick={handleClear}
        >
          <IconComponent className="size-3.5" icon="X" />
        </Button>
      ) : null}
    </div>
  )
}
