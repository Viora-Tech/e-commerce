'use client'

import { type BoxPreset, volumetricWeightGrams } from '@commerce/core'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useEffect, useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/products'
import { api } from '@/lib/api-client'
import type { VariantRow } from './form-state'

type ShippingCardProps = {
  variant: VariantRow
  onChange: (patch: Partial<VariantRow>) => void
}

const copy = productFormContent.shipping
const NONE = '__none'
const STORE_DEFAULT = '__store_default'
const CUSTOM = '__custom'

const round1 = (n: number) => Math.round(n * 10) / 10

/** Weight, customs fields for international labels, and the package this variant ships in. */
export default function ShippingCard({ variant, onChange }: ShippingCardProps) {
  // Hooks
  const [boxPresets, setBoxPresets] = useState<BoxPreset[]>([])

  useEffect(() => {
    api.store
      .getShipping()
      .then((r) => setBoxPresets(r.settings.boxPresets ?? []))
      .catch(() => setBoxPresets([]))
  }, [])

  // Event handlers
  const handlePackage = (next: string) => {
    if (next === STORE_DEFAULT) {
      onChange({
        boxPresetId: null,
        packageLengthCm: null,
        packageWidthCm: null,
        packageHeightCm: null,
      })
    } else if (next === CUSTOM) {
      onChange({ boxPresetId: null })
    } else {
      onChange({
        boxPresetId: next,
        packageLengthCm: null,
        packageWidthCm: null,
        packageHeightCm: null,
      })
    }
  }

  // Render logic
  const items = Object.fromEntries([
    [NONE, copy.countryPlaceholder],
    ...COUNTRIES.map((c) => [c.code, c.name]),
  ])
  const hasCustomDims =
    variant.packageLengthCm != null || variant.packageWidthCm != null || variant.packageHeightCm != null
  const packageValue = hasCustomDims ? CUSTOM : variant.boxPresetId ?? STORE_DEFAULT
  const dims =
    variant.packageLengthCm && variant.packageWidthCm && variant.packageHeightCm
      ? {
          lengthCm: variant.packageLengthCm,
          widthCm: variant.packageWidthCm,
          heightCm: variant.packageHeightCm,
        }
      : boxPresets.find((b) => b.id === variant.boxPresetId)
  const volumetricKg = dims
    ? volumetricWeightGrams({
        lengthCm: dims.lengthCm,
        widthCm: dims.widthCm,
        heightCm: dims.heightCm,
      }) / 1000
    : null
  const actualGrams = Number(variant.weight)
  const actualKg = variant.weight.trim() && Number.isFinite(actualGrams) ? actualGrams / 1000 : null
  const billedKg =
    volumetricKg != null && actualKg != null
      ? Math.max(volumetricKg, actualKg)
      : volumetricKg ?? actualKg

  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="variant-weight">{copy.weight}</FieldLabel>
              <MoneyInput
                size="lg"
                id="variant-weight"
                currency={false}
                suffix="g"
                value={variant.weight}
                onChange={(weight) => onChange({ weight })}
              />
              <FieldDescription>{copy.weightHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-hs">{copy.hsCode}</FieldLabel>
              <Input
                size="lg"
                id="variant-hs"
                value={variant.hsCode}
                onChange={(e) => onChange({ hsCode: e.target.value })}
                autoComplete="off"
                inputMode="numeric"
              />
              <FieldDescription>{copy.hsCodeHelp}</FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor="variant-gst">{copy.gstRate}</FieldLabel>
              <Input
                size="lg"
                id="variant-gst"
                value={variant.gstRate}
                onChange={(e) =>
                  onChange({ gstRate: e.target.value.replace(/\D/g, '').slice(0, 2) })
                }
                autoComplete="off"
                inputMode="numeric"
              />
              <FieldDescription>{copy.gstRateHelp}</FieldDescription>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="variant-origin">{copy.country}</FieldLabel>
            <Select
              items={items}
              value={variant.countryOfOrigin || NONE}
              onValueChange={(next) =>
                onChange({ countryOfOrigin: next === NONE ? '' : String(next) })
              }
            >
              <SelectTrigger size="lg" id="variant-origin" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>{copy.countryPlaceholder}</SelectItem>
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} value={country.code}>
                    {country.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.countryHelp}</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="variant-package">{copy.package}</FieldLabel>
            <Select value={packageValue} onValueChange={(next) => handlePackage(String(next))}>
              <SelectTrigger size="lg" id="variant-package" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STORE_DEFAULT}>{copy.packageStoreDefault}</SelectItem>
                {boxPresets.map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    {box.name}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>{copy.packageCustom}</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>{copy.packageHelp}</FieldDescription>
          </Field>
          {packageValue === CUSTOM ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="variant-package-length">{copy.packageLength}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-length"
                  type="number"
                  min={1}
                  value={variant.packageLengthCm ?? ''}
                  onChange={(e) =>
                    onChange({ packageLengthCm: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="variant-package-width">{copy.packageWidth}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-width"
                  type="number"
                  min={1}
                  value={variant.packageWidthCm ?? ''}
                  onChange={(e) =>
                    onChange({ packageWidthCm: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="variant-package-height">{copy.packageHeight}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-height"
                  type="number"
                  min={1}
                  value={variant.packageHeightCm ?? ''}
                  onChange={(e) =>
                    onChange({ packageHeightCm: e.target.value ? Number(e.target.value) : null })
                  }
                />
              </Field>
            </div>
          ) : null}
          {volumetricKg != null ? (
            <p className="text-caption text-muted-foreground">
              {copy.packageVolumetric(round1(volumetricKg))}
              {actualKg != null ? ` · ${copy.packageActual(round1(actualKg))}` : ''}
              {billedKg != null ? ` · ${copy.packageBillingHint(round1(billedKg))}` : ''}
            </p>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
