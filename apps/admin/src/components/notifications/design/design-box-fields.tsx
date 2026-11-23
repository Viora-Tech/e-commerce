'use client'

import { type Align, type BlockBox, SPACES, type Space } from '@commerce/notifications/design'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignChoiceField from './design-choice-field'
import DesignColourField from './design-colour-field'

type DesignBoxFieldsProps = {
  /** Field ids start with this. */
  id: string
  box: BlockBox | undefined
  /** Whether the block lines its content up left, centre or right. */
  withAlign: boolean
  onChange: (box: BlockBox | undefined) => void
}

const KEEP = 'keep'

/** Drops empty fields; no box at all when nothing is set, so the block draws as built in. */
function tidy(box: BlockBox): BlockBox | undefined {
  const out = Object.fromEntries(Object.entries(box).filter(([, v]) => v !== undefined))
  return Object.keys(out).length > 0 ? (out as BlockBox) : undefined
}

/** A block's Layout: a background band, space above and below, and its alignment. */
export default function DesignBoxFields({ id, box, withAlign, onChange }: DesignBoxFieldsProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)

  // Helpers
  const space = (v: string) => (v === KEEP ? undefined : (v as Space))

  // Event handlers
  const handleSet = (patch: Partial<BlockBox>) => onChange(tidy({ ...box, ...patch }))

  // Render logic
  const c = copy.box
  const spaceOptions = [
    { value: KEEP, label: c.keep },
    ...SPACES.map((s) => ({ value: s, label: c[s] })),
  ]

  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
      <legend className="pb-2 text-caption font-semibold text-muted-foreground">{c.title}</legend>
      <DesignColourField
        label={c.background}
        value={box?.background}
        fallback="#ffffff"
        onChange={(background) => handleSet({ background })}
      />
      <div className="grid grid-cols-2 gap-2">
        <DesignChoiceField
          id={`${id}-top`}
          label={c.top}
          value={box?.top ?? KEEP}
          options={spaceOptions}
          onChange={(v) => handleSet({ top: space(v) })}
        />
        <DesignChoiceField
          id={`${id}-bottom`}
          label={c.bottom}
          value={box?.bottom ?? KEEP}
          options={spaceOptions}
          onChange={(v) => handleSet({ bottom: space(v) })}
        />
      </div>
      {withAlign ? (
        <DesignChoiceField
          id={`${id}-align`}
          label={c.align}
          value={box?.align ?? KEEP}
          options={[
            { value: KEEP, label: c.keep },
            { value: 'left', label: c.left },
            { value: 'center', label: c.center },
            { value: 'right', label: c.right },
          ]}
          onChange={(v) => handleSet({ align: v === KEEP ? undefined : (v as Align) })}
        />
      ) : null}
    </fieldset>
  )
}
