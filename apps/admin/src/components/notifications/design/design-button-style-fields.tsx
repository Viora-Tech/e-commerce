'use client'

import type { ButtonShape, ButtonStyle } from '@commerce/notifications/design'
import SwitchRow from '@/components/fields/switch-row'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import DesignChoiceField from './design-choice-field'
import DesignColourField from './design-colour-field'

type DesignButtonStyleFieldsProps = {
  id: string
  value: ButtonStyle | undefined
  onChange: (style: ButtonStyle | undefined) => void
}

const KEEP = 'keep'

function tidy(style: ButtonStyle): ButtonStyle | undefined {
  const out = Object.fromEntries(
    Object.entries(style).filter(([, v]) => v !== undefined && v !== false),
  )
  return Object.keys(out).length > 0 ? (out as ButtonStyle) : undefined
}

/** A button's colour, text colour, shape and width (one button, or every button of the email). */
export default function DesignButtonStyleFields({
  id,
  value,
  onChange,
}: DesignButtonStyleFieldsProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)

  // Event handlers
  const handleSet = (patch: Partial<ButtonStyle>) => onChange(tidy({ ...value, ...patch }))

  // Render logic
  const c = copy.button

  return (
    <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
      <legend className="pb-2 text-caption font-semibold text-muted-foreground">{c.title}</legend>
      <DesignColourField
        label={c.background}
        value={value?.background}
        fallback="#161615"
        onChange={(background) => handleSet({ background })}
      />
      <DesignColourField
        label={c.text}
        value={value?.text}
        fallback="#ffffff"
        onChange={(text) => handleSet({ text })}
      />
      <DesignChoiceField
        id={`${id}-shape`}
        label={c.shape}
        value={value?.shape ?? KEEP}
        options={[
          { value: KEEP, label: copy.box.keep },
          { value: 'square', label: c.square },
          { value: 'rounded', label: c.rounded },
          { value: 'pill', label: c.pill },
        ]}
        onChange={(v) => handleSet({ shape: v === KEEP ? undefined : (v as ButtonShape) })}
      />
      <SwitchRow
        id={`${id}-full`}
        label={c.full}
        weight="normal"
        checked={value?.full === true}
        onChange={(full) => handleSet({ full })}
      />
    </fieldset>
  )
}
