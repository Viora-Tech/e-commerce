'use client'

import type { BoxPreset } from '@commerce/core'
import { type PackageDimensionsCm, volumetricWeightGrams } from '@commerce/core/parcel'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import MoneyInput from '@/components/fields/money-input'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/products'
import { api } from '@/lib/api-client'
import type { VariantRow } from './form-state'

type ShippingCardProps = {
  variant: VariantRow
  /** Without options the card edits the only variant; with them, the package still covers all. */
  singleVariant: boolean
  packageError?: string | undefined
  /** Weight and customs fields, for the variant shown. */
  onChange: (patch: Partial<VariantRow>) => void
  /** Package fields, applied to every variant. */
  onPackage: (patch: Partial<VariantRow>) => void
}

const copy = productFormContent.shipping
const NONE = '__none'
const STORE_DEFAULT = '__store_default'
const CUSTOM = '__custom'

const NO_BOX = {
  boxPresetId: null,
  packageLengthCm: null,
  packageWidthCm: null,
  packageHeightCm: null,
} satisfies Partial<VariantRow>

const round1 = (n: number) => Math.round(n * 10) / 10

/** Whole centimetres from a number field; blank clears it. */
function toCm(text: string): number | null {
  const n = Math.round(Number(text))
  return text.trim() === '' || !Number.isFinite(n) || n < 1 ? null : Math.min(n, 200)
}

/** The box in use: custom dimensions when all three are set, else the named preset. */
function packageDims(variant: VariantRow, presets: BoxPreset[]): PackageDimensionsCm | null {
  const { packageLengthCm: l, packageWidthCm: w, packageHeightCm: h } = variant
  if (l && w && h) return { lengthCm: l, widthCm: w, heightCm: h }
  const preset = presets.find((b) => b.id === variant.boxPresetId)
  return preset
    ? { lengthCm: preset.lengthCm, widthCm: preset.widthCm, heightCm: preset.heightCm }
    : null
}

/** Weight, customs fields for international labels, and the package this variant ships in. */
export default function ShippingCard({
  variant,
  singleVariant,
  packageError,
  onChange,
  onPackage,
}: ShippingCardProps) {
  // Hooks
  const [boxPresets, setBoxPresets] = useState<BoxPreset[]>([])
  /* "Custom size" picked but no dimension typed yet still shows the inputs. */
  const [customPicked, setCustomPicked] = useState(false)

  useEffect(() => {
    api.store
      .getShipping()
      .then((r) => setBoxPresets(r.settings.boxPresets ?? []))
      .catch(() => setBoxPresets([]))
  }, [])

  // Event handlers
  const handlePackage = (next: string) => {
    setCustomPicked(next === CUSTOM)
    if (next === CUSTOM) {
      /* Start from the box in use, so switching to custom is a tweak rather than a blank form. */
      const from = packageDims(variant, boxPresets)
      onPackage({
        boxPresetId: null,
        packageLengthCm: from?.lengthCm ?? null,
        packageWidthCm: from?.widthCm ?? null,
        packageHeightCm: from?.heightCm ?? null,
      })
    } else {
      onPackage({ ...NO_BOX, boxPresetId: next === STORE_DEFAULT ? null : next })
    }
  }

  // Render logic
  const items = Object.fromEntries([
    [NONE, copy.countryPlaceholder],
    ...COUNTRIES.map((c) => [c.code, c.name]),
  ])
  const hasCustomDims =
    variant.packageLengthCm != null ||
    variant.packageWidthCm != null ||
    variant.packageHeightCm != null
  const packageValue =
    hasCustomDims || (customPicked && !variant.boxPresetId)
      ? CUSTOM
      : (variant.boxPresetId ?? STORE_DEFAULT)
  const packageItems = Object.fromEntries([
    [STORE_DEFAULT, copy.packageStoreDefault],
    ...boxPresets.map((b) => [b.id, copy.packageOption(b.name, b.lengthCm, b.widthCm, b.heightCm)]),
    [CUSTOM, copy.packageCustom],
  ])
  const dims = packageDims(variant, boxPresets)
  const volumetricKg = dims ? volumetricWeightGrams(dims) / 1000 : null
  const actualGrams = Number(variant.weight)
  const actualKg = variant.weight.trim() && Number.isFinite(actualGrams) ? actualGrams / 1000 : null
  const billedKg =
    volumetricKg != null && actualKg != null
      ? Math.max(volumetricKg, actualKg)
      : (volumetricKg ?? actualKg)

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
            <Select
              items={packageItems}
              value={packageValue}
              onValueChange={(next) => handlePackage(String(next))}
            >
              <SelectTrigger size="lg" id="variant-package" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={STORE_DEFAULT}>{copy.packageStoreDefault}</SelectItem>
                {boxPresets.map((box) => (
                  <SelectItem key={box.id} value={box.id}>
                    {packageItems[box.id]}
                  </SelectItem>
                ))}
                <SelectItem value={CUSTOM}>{copy.packageCustom}</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              {copy.packageHelp} {singleVariant ? null : `${copy.packageAllVariants} `}
              <Link href="/settings/shipping" className="underline underline-offset-2">
                {copy.packageManage}
              </Link>
            </FieldDescription>
          </Field>
          {packageValue === CUSTOM ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Field>
                <FieldLabel htmlFor="variant-package-length">{copy.packageLength}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-length"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  step={1}
                  value={variant.packageLengthCm ?? ''}
                  onChange={(e) => onPackage({ packageLengthCm: toCm(e.target.value) })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="variant-package-width">{copy.packageWidth}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-width"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  step={1}
                  value={variant.packageWidthCm ?? ''}
                  onChange={(e) => onPackage({ packageWidthCm: toCm(e.target.value) })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="variant-package-height">{copy.packageHeight}</FieldLabel>
                <Input
                  size="lg"
                  id="variant-package-height"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  step={1}
                  value={variant.packageHeightCm ?? ''}
                  onChange={(e) => onPackage({ packageHeightCm: toCm(e.target.value) })}
                />
              </Field>
            </div>
          ) : null}
          {packageError ? <FieldError>{packageError}</FieldError> : null}
          {volumetricKg != null ? (
            <p className="text-caption text-muted-foreground">
              {copy.packageVolumetric(round1(volumetricKg))}
              {actualKg != null ? `, ${copy.packageActual(round1(actualKg))}` : ''}
              {actualKg != null && billedKg != null
                ? `; ${copy.packageBillingHint(round1(billedKg))}`
                : ''}
            </p>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
