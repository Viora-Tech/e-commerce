'use client'

import { TEMPLATE_KINDS, type TemplateKind, templateName } from '@commerce/core/theme'
import { ChevronDown, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@commerce/ui/shadcn/dropdown-menu'
import { customizeContent } from '@/data/customize'

export type TemplateRef = { key: TemplateKind; suffix: string }

type TemplatePickerProps = {
  value: TemplateRef
  /** Stored alternates of this theme, by kind. */
  alternates: { template: string; suffix: string }[]
  onChange: (ref: TemplateRef) => void
  onCreate: () => void
}

const copy = customizeContent.templates

export const templateLabel = (ref: TemplateRef) =>
  ref.suffix ? copy.alternate(copy.names[ref.key], ref.suffix) : copy.names[ref.key]

/** Shopify's template dropdown in the top bar: every template kind, its alternates, and Create. */
export default function TemplatePicker({
  value,
  alternates,
  onChange,
  onCreate,
}: TemplatePickerProps) {
  // Render logic
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="outline" className="min-w-52 justify-between" aria-label={copy.label}>
            <span className="truncate">{templateLabel(value)}</span>
            <ChevronDown aria-hidden />
          </Button>
        }
      />
      <DropdownMenuContent align="center" className="w-64">
        {TEMPLATE_KINDS.map((key) => {
          const own = alternates.filter((a) => a.template === key && a.suffix)
          return (
            <DropdownMenuGroup key={key}>
              {own.length > 0 ? <DropdownMenuLabel>{copy.names[key]}</DropdownMenuLabel> : null}
              <DropdownMenuItem onClick={() => onChange({ key, suffix: '' })}>
                {own.length > 0 ? copy.default : copy.names[key]}
              </DropdownMenuItem>
              {own.map((a) => (
                <DropdownMenuItem
                  key={templateName(key, a.suffix)}
                  className="pl-5"
                  onClick={() => onChange({ key, suffix: a.suffix })}
                >
                  {a.suffix}
                </DropdownMenuItem>
              ))}
            </DropdownMenuGroup>
          )
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onCreate}>
          <Plus aria-hidden />
          {copy.create}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
