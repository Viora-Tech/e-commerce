import { Search } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@commerce/ui/shadcn/input-group'
import type { ComponentProps } from 'react'

type SearchFieldProps = Omit<ComponentProps<typeof InputGroupInput>, 'className' | 'type'> & {
  /** `sm` (2rem) for dense toolbars; `default` and `lg` are the 2.25rem control height. */
  size?: 'sm' | 'default' | 'lg'
  /** `search` (default) or `text` where the browser's search semantics get in the way. */
  type?: 'search' | 'text'
  /** Classes for the box (width, flex). */
  className?: string
}

/**
 * The one search box: a search glyph inside the field, then the text input. Every list, picker
 * and dialog search uses it so the height, radius, fill and glyph match.
 */
export default function SearchField({
  size = 'default',
  type = 'search',
  className,
  ...rest
}: SearchFieldProps) {
  // Render logic
  return (
    // The `lg` group is the filled 2.25rem field every Input and Select uses.
    <InputGroup size="lg" className={cn(size === 'sm' && 'data-[size=lg]:h-8', className)}>
      <InputGroupAddon>
        <Search aria-hidden="true" />
      </InputGroupAddon>
      <InputGroupInput
        type={type}
        autoComplete="off"
        className="[&::-webkit-search-cancel-button]:hidden"
        {...rest}
      />
    </InputGroup>
  )
}
