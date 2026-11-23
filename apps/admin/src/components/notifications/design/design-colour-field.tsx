'use client'

import { RotateCcw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import ColourField from '@/components/themes/colour-field'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'

type DesignColourFieldProps = {
  label: string
  /** The merchant's colour, or undefined for the built-in one. */
  value: string | undefined
  /** What the email uses when nothing is set, shown in the swatch. */
  fallback: string
  onChange: (hex: string | undefined) => void
}

/** A colour a block or the email may set; the arrow puts the built-in colour back. */
export default function DesignColourField({
  label,
  value,
  fallback,
  onChange,
}: DesignColourFieldProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)

  // Render logic
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <ColourField
          label={value ? label : `${label} (${copy.colour.builtIn})`}
          value={value ?? fallback}
          onChange={(hex) => onChange(hex.toLowerCase())}
        />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={copy.colour.clear(label)}
        title={copy.colour.clear(label)}
        disabled={!value}
        onClick={() => onChange(undefined)}
      >
        <RotateCcw aria-hidden="true" />
      </Button>
    </div>
  )
}
