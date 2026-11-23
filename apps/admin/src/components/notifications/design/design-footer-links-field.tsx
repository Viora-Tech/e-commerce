'use client'

import { DESIGN_LIMITS } from '@commerce/notifications/design'
import { Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignLinkField from './design-link-field'
import DesignTextField from './design-text-field'

type Link = { label: string; url: string }

type DesignFooterLinksFieldProps = {
  id: string
  links: Link[]
  onChange: (links: Link[] | undefined) => void
}

/** The footer's own links (Returns, FAQ...), up to six, in one row under the note. */
export default function DesignFooterLinksField({
  id,
  links,
  onChange,
}: DesignFooterLinksFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)

  // Event handlers
  const handleSet = (i: number, patch: Partial<Link>) =>
    onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  const handleRemove = (i: number) => {
    const next = links.filter((_, j) => j !== i)
    onChange(next.length > 0 ? next : undefined)
  }

  // Render logic
  const f = copy.footer

  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
      <legend className="pb-2 text-caption font-semibold text-muted-foreground">{f.links}</legend>
      {links.map((l, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are positions in a short list
        <div key={i} className="flex flex-col gap-2 rounded-md border border-border p-2">
          <div className="flex items-end gap-1">
            <div className="min-w-0 flex-1">
              <DesignTextField
                id={`${id}-${i}-label`}
                label={f.linkLabel}
                value={l.label}
                maxLength={DESIGN_LIMITS.label}
                onChange={(label) => handleSet(i, { label })}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={f.removeLink(l.label)}
              onClick={() => handleRemove(i)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
          <DesignLinkField
            id={`${id}-${i}-url`}
            value={l.url}
            onChange={(url) => handleSet(i, { url })}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={links.length >= DESIGN_LIMITS.links}
        onClick={() => onChange([...links, { label: '', url: '{{shop_url}}' }])}
      >
        <Plus aria-hidden="true" />
        {f.addLink}
      </Button>
    </fieldset>
  )
}
