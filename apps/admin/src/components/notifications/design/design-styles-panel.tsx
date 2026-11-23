'use client'

import {
  type DesignStyles,
  EMAIL_FONT_KEYS,
  type EmailFont,
  type EmailTemplateDesign,
  STYLE_LIMITS,
} from '@commerce/notifications/design'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { emailDesignFieldsContent } from '@/data/email-design-fields'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import DesignButtonStyleFields from './design-button-style-fields'
import DesignChoiceField from './design-choice-field'
import DesignColourField from './design-colour-field'

type DesignStylesPanelProps = {
  design: EmailTemplateDesign
  /** `group` folds a run of changes into one undo step. */
  onChange: (design: EmailTemplateDesign, group?: string) => void
}

const KEEP = 'keep'
const SIZES = [13, 14, 15, 16, 17, 18]
const WIDTHS = [520, 620, 680, 720]

/** The built-in look each colour starts from. */
const COLOURS = [
  ['text', '#55534d'],
  ['heading', '#161615'],
  ['link', '#6d28d9'],
  ['accent', '#6d28d9'],
  ['background', '#f4f3ef'],
  ['card', '#ffffff'],
] as const

function tidy(styles: DesignStyles): DesignStyles | undefined {
  const out = Object.fromEntries(Object.entries(styles).filter(([, v]) => v !== undefined))
  return Object.keys(out).length > 0 ? (out as DesignStyles) : undefined
}

/**
 * The whole email's look (Shopify's "Customize email templates"): font from the fonts every
 * inbox has, text size, colours, width and the button style. Kept with this design; "Use for all
 * emails" saves the same styles in Email branding.
 */
export default function DesignStylesPanel({ design, onChange }: DesignStylesPanelProps) {
  // Hooks
  const copy = useCopy(emailDesignFieldsContent)
  const [saving, setSaving] = useState(false)

  // Helpers
  const set = (patch: Partial<DesignStyles>) =>
    onChange({ ...design, styles: tidy({ ...design.styles, ...patch }) }, 'styles')
  const num = (v: string) => (v === KEEP ? undefined : Number(v))

  // Event handlers
  const handleForAll = async () => {
    setSaving(true)
    try {
      const o = await api.notifications.branding()
      await api.notifications.saveBranding({ ...(o.saved ?? {}), styles: design.styles })
      toast.success(copy.styles.forAllDone)
    } catch {
      toast.error(copy.styles.forAllFailed)
    } finally {
      setSaving(false)
    }
  }

  // Render logic
  const s = copy.styles
  const styles = design.styles ?? {}
  return (
    <section aria-label={s.title} className="flex flex-col gap-3">
      <p className="text-caption text-muted-foreground">
        {s.help}{' '}
        <Link href={routes.settings.emailBranding()} className="text-primary underline">
          {s.branding}
        </Link>
      </p>
      <DesignChoiceField
        id="design-styles-font"
        label={s.font}
        value={styles.font ?? KEEP}
        options={[
          { value: KEEP, label: copy.box.keep },
          ...EMAIL_FONT_KEYS.map((f) => ({ value: f, label: s.fonts[f] ?? f })),
        ]}
        onChange={(v) => set({ font: v === KEEP ? undefined : (v as EmailFont) })}
      />
      <div className="grid grid-cols-2 gap-2">
        <DesignChoiceField
          id="design-styles-size"
          label={s.size}
          value={String(styles.size ?? STYLE_LIMITS.sizeBase)}
          options={SIZES.map((n) => ({ value: String(n), label: s.sizes[n] ?? String(n) }))}
          onChange={(v) => set({ size: num(v) === STYLE_LIMITS.sizeBase ? undefined : num(v) })}
        />
        <DesignChoiceField
          id="design-styles-width"
          label={s.width}
          value={String(styles.width ?? STYLE_LIMITS.widthBase)}
          options={WIDTHS.map((n) => ({ value: String(n), label: s.widths[n] ?? String(n) }))}
          onChange={(v) => set({ width: num(v) === STYLE_LIMITS.widthBase ? undefined : num(v) })}
        />
      </div>
      <fieldset className="flex flex-col gap-3 border-t border-border pt-3">
        <legend className="pb-2 text-caption font-semibold text-muted-foreground">
          {s.colours}
        </legend>
        {COLOURS.map(([key, fallback]) => (
          <DesignColourField
            key={key}
            label={s[key]}
            value={styles[key]}
            fallback={fallback}
            onChange={(hex) => set({ [key]: hex })}
          />
        ))}
      </fieldset>
      <DesignButtonStyleFields
        id="design-styles-button"
        value={styles.button}
        onChange={(button) => set({ button })}
      />
      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <p className="text-caption text-muted-foreground">{s.forAllHint}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            loading={saving}
            disabled={saving || !design.styles}
            onClick={handleForAll}
          >
            {s.forAll}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={!design.styles}
            onClick={() => onChange({ ...design, styles: undefined })}
          >
            {s.clear}
          </Button>
        </div>
      </div>
    </section>
  )
}
