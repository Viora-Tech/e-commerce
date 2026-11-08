'use client'

import type { BoxPreset } from '@commerce/core'
import { type PackageDimensionsCm, volumetricWeightGrams } from '@commerce/core/parcel'
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
import { Switch } from '@commerce/ui/shadcn/switch'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import KitField from '@/components/kit/kit-field'
import DataCard from '@/components/layout/data-card'
import { COUNTRIES } from '@/data/countries'
import { productFormContent } from '@/data/product-form'
import { productShippingContent } from '@/data/product-shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import type { VariantRow } from './form-state'
import type { ProductTax } from './product-tax'
import ProductTaxFields from './product-tax-fields'
import WeightInput from './weight-input'
import { toGrams } from './weight-units'

type ShippingCardProps = {
  variant: VariantRow
  /** Without options the card edits the only variant; with them, the package still covers all. */
  singleVariant: boolean
  packageError?: string | undefined
  /** HSN code and GST rate for the whole product (#63). */
  tax: ProductTax
  onTax: (tax: ProductTax) => void
  /** Weight and customs fields, for the variant shown. */
  onChange: (patch: Partial<VariantRow>) => void
  /** Package fields, applied to every variant. */
  onPackage: (patch: Partial<VariantRow>) => void
}

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
  tax,
  onTax,
  onChange,
  onPackage,
}: ShippingCardProps) {
  // Hooks
  const { shipping: copy } = useCopy(productFormContent)
  const physical = useCopy(productShippingContent)
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
  const actualGrams = toGrams(variant.weight, variant.weightUnit)
  const actualKg = actualGrams == null ? null : actualGrams / 1000
  const billedKg =
    volumetricKg != null && actualKg != null
      ? Math.max(volumetricKg, actualKg)
      : (volumetricKg ?? actualKg)

  return (
    <DataCard title={copy.heading}>
      <FieldGroup>
        {/* HSN once for the product (#63); weight and origin stay per variant (#914). Without
            options the GST rate sits beside "Charge tax" on Price & stock (audit #135). */}
        <ProductTaxFields
          tax={tax}
          singleVariant={singleVariant}
          part={singleVariant ? 'customs' : 'all'}
          onChange={onTax}
        />
        {singleVariant ? null : (
          <p className="text-body text-muted-foreground">{copy.perVariant}</p>
        )}
        {/* Shopify's "This is a physical product"; with options each variant sets its own. */}
        {singleVariant ? (
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <label htmlFor="variant-physical" className="text-body text-foreground">
                {physical.physical}
              </label>
              <p className="text-caption text-muted-foreground">{physical.physicalHelp}</p>
            </div>
            <Switch
              id="variant-physical"
              checked={variant.requiresShipping}
              onCheckedChange={(requiresShipping) => onChange({ requiresShipping })}
            />
          </div>
        ) : null}
        {/* One form style across the product page: label above the field (audit #28). */}
        {singleVariant && variant.requiresShipping ? (
          <div className="grid gap-4 md:grid-cols-2">
            <KitField label={copy.weight} help={copy.weightHelp} htmlFor="variant-weight">
              <WeightInput
                id="variant-weight"
                weight={variant.weight}
                unit={variant.weightUnit}
                onChange={onChange}
              />
            </KitField>
            <KitField label={copy.country} help={copy.countryHelp} htmlFor="variant-origin">
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
            </KitField>
          </div>
        ) : null}
        <KitField label={copy.package} htmlFor="variant-package">
          <Select
            items={packageItems}
            value={packageValue}
            onValueChange={(next) => handlePackage(String(next))}
          >
            <SelectTrigger size="lg" id="variant-package" className="w-full md:max-w-[20.75rem]">
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
            {`${copy.packageHelp} `}
            {singleVariant ? null : `${copy.packageAllVariants} `}
            <Link href={routes.settings.shipping()} className="underline underline-offset-2">
              {copy.packageManage}
            </Link>
          </FieldDescription>
        </KitField>
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
    </DataCard>
  )
}
