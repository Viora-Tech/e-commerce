'use client'

import {
  CHECKOUT_CORNERS,
  CHECKOUT_FONT_IDS,
  type CheckoutBranding,
} from '@commerce/core/checkout-settings'
import { THEME_FONTS } from '@commerce/core/theme'
import { Monitor, Smartphone } from '@commerce/ui/icons'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { FieldGroup } from '@commerce/ui/shadcn/field'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { useState } from 'react'
import CheckoutBrandingPreview, {
  type PreviewDevice,
} from '@/components/settings/checkout-branding-preview'
import CheckoutImageField from '@/components/settings/checkout-image-field'
import CheckoutToggleRow from '@/components/settings/checkout-toggle-row'
import ChoiceField from '@/components/themes/choice-field'
import ColourField from '@/components/themes/colour-field'
import { checkoutBrandingContent } from '@/data/checkout-settings'
import { useCopy } from '@/hooks/use-copy'

type CheckoutBrandingSettingsProps = {
  branding: CheckoutBranding
  gstin: boolean
  orderNotes: boolean
  storeName: string
  onBranding: (patch: Partial<CheckoutBranding>) => void
  onGstin: (on: boolean) => void
  onOrderNotes: (on: boolean) => void
}

/**
 * Settings → Checkout → Branding: the few choices the locked checkout takes (logo,
 * colours, one font, corners, the summary's background, three things to show or hide),
 * with a live preview beside them on a computer or a phone.
 */
export default function CheckoutBrandingSettings({
  branding,
  gstin,
  orderNotes,
  storeName,
  onBranding,
  onGstin,
  onOrderNotes,
}: CheckoutBrandingSettingsProps) {
  // Hooks
  const copy = useCopy(checkoutBrandingContent)
  const [device, setDevice] = useState<PreviewDevice>('desktop')

  // Event handlers
  const handleDevice = (values: unknown[]) => {
    const next = values[0]
    if (next === 'desktop' || next === 'phone') setDevice(next)
  }

  // Render logic
  const summary = branding.summary
  const fonts = CHECKOUT_FONT_IDS.map((id) => ({ value: id, label: THEME_FONTS[id].label }))
  const corners = CHECKOUT_CORNERS.map((c) => ({ value: c, label: copy.look.cornerChoices[c] }))
  const kinds = (['solid', 'image'] as const).map((k) => ({
    value: k,
    label: copy.summary.kindChoices[k],
  }))

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <p className="text-body text-muted-foreground">{copy.intro}</p>
        <Card size="form">
          <CardHeader>
            <CardTitle>{copy.look.heading}</CardTitle>
            <CardDescription>{copy.look.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <CheckoutImageField
                label={copy.look.logo}
                hint={copy.look.logoHint}
                value={branding.logo}
                pickLabel={copy.look.pickLogo}
                removeLabel={copy.look.remove}
                dialogTitle={copy.look.logoDialog}
                empty={copy.look.noImages}
                fit="contain"
                onChange={(logo) => onBranding({ logo })}
              />
              <div className="flex flex-col gap-1">
                <ColourField
                  label={copy.look.accent}
                  value={branding.accent}
                  onChange={(accent) => onBranding({ accent })}
                />
                <p className="text-caption text-muted-foreground">{copy.look.accentHint}</p>
              </div>
              <div className="flex flex-col gap-1">
                <ColourField
                  label={copy.look.button}
                  value={branding.button}
                  onChange={(button) => onBranding({ button })}
                />
                <p className="text-caption text-muted-foreground">{copy.look.buttonHint}</p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span className="text-body text-foreground">{copy.look.font}</span>
                <ToggleGroup
                  value={[branding.font]}
                  onValueChange={(values: unknown[]) => {
                    const next = fonts.find((f) => f.value === values[0])
                    if (next) onBranding({ font: next.value })
                  }}
                  variant="outline"
                  size="sm"
                  aria-label={copy.look.font}
                  className="grid w-full grid-cols-2 sm:grid-cols-3"
                >
                  {fonts.map((f) => (
                    <ToggleGroupItem
                      key={f.value}
                      value={f.value}
                      style={{ fontFamily: `"${f.label}", sans-serif` }}
                    >
                      {f.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>
              <ChoiceField
                label={copy.look.corners}
                value={branding.corners}
                options={corners}
                onChange={(c) => onBranding({ corners: c })}
              />
            </FieldGroup>
          </CardContent>
        </Card>

        <Card size="form">
          <CardHeader>
            <CardTitle>{copy.summary.heading}</CardTitle>
            <CardDescription>{copy.summary.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <ChoiceField
                label={copy.summary.kind}
                value={summary.kind}
                options={kinds}
                onChange={(kind) => onBranding({ summary: { ...summary, kind } })}
              />
              <ColourField
                label={copy.summary.colour}
                value={summary.colour}
                onChange={(colour) => onBranding({ summary: { ...summary, colour } })}
              />
              {summary.kind === 'image' ? (
                <CheckoutImageField
                  label={copy.summary.kindChoices.image}
                  hint={copy.summary.imageHint}
                  value={summary.image}
                  pickLabel={copy.summary.pickImage}
                  removeLabel={copy.look.remove}
                  dialogTitle={copy.summary.imageDialog}
                  empty={copy.look.noImages}
                  fit="cover"
                  onChange={(image) => onBranding({ summary: { ...summary, image } })}
                />
              ) : null}
            </FieldGroup>
          </CardContent>
        </Card>

        <Card size="form" id="gstin">
          <CardHeader>
            <CardTitle>{copy.shown.heading}</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup>
              <CheckoutToggleRow
                id="checkout-gstin"
                label={copy.shown.gstin}
                hint={copy.shown.gstinHint}
                checked={gstin}
                onChange={onGstin}
              />
              <CheckoutToggleRow
                id="checkout-notes"
                label={copy.shown.notes}
                hint={copy.shown.notesHint}
                checked={orderNotes}
                onChange={onOrderNotes}
              />
              <CheckoutToggleRow
                id="checkout-trust"
                label={copy.shown.trust}
                hint={copy.shown.trustHint}
                checked={branding.trustBadges}
                onChange={(trustBadges) => onBranding({ trustBadges })}
              />
            </FieldGroup>
          </CardContent>
        </Card>
      </div>

      <Card className="xl:sticky xl:top-20">
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>{copy.preview.heading}</CardTitle>
            <CardDescription>{copy.preview.description}</CardDescription>
          </div>
          <ToggleGroup value={[device]} onValueChange={handleDevice} variant="outline" spacing={0}>
            <ToggleGroupItem
              value="desktop"
              aria-label={copy.preview.desktop}
              title={copy.preview.desktop}
            >
              <Monitor aria-hidden />
            </ToggleGroupItem>
            <ToggleGroupItem
              value="phone"
              aria-label={copy.preview.phone}
              title={copy.preview.phone}
            >
              <Smartphone aria-hidden />
            </ToggleGroupItem>
          </ToggleGroup>
        </CardHeader>
        <CardContent>
          <CheckoutBrandingPreview branding={branding} device={device} storeName={storeName} />
        </CardContent>
      </Card>
    </div>
  )
}
