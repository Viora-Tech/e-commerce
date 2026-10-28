'use client'

import { MARKET_LANGUAGES } from '@commerce/core/markets'
import { Checkbox } from '@commerce/ui/shadcn/checkbox'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from '@commerce/ui/shadcn/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'

type MarketLanguageFieldsProps = {
  locale: string
  locales: string[]
  /** A language whose address another market already answers on. */
  error: string | undefined
  onChange: (patch: { locale?: string; locales?: string[] }) => void
}

/** The market's default language and the others shoppers can switch to. */
export default function MarketLanguageFields({
  locale,
  locales,
  error,
  onChange,
}: MarketLanguageFieldsProps) {
  // Hooks
  const copy = useCopy(marketsContent)

  // Helpers
  const name = (code: string) => copy.languages[code] ?? code

  // Event handlers
  const handleDefault = (next: string) => {
    onChange({ locale: next, locales: locales.filter((l) => l !== next) })
  }
  const handleExtra = (code: string, on: boolean) => {
    onChange({ locales: on ? [...locales, code] : locales.filter((l) => l !== code) })
  }

  // Render logic
  const text = copy.dialog.language

  return (
    <>
      <Field>
        <FieldLabel htmlFor="market-locale">{text.label}</FieldLabel>
        <Select value={locale} onValueChange={(v) => v && handleDefault(String(v))}>
          <SelectTrigger id="market-locale" className="w-full">
            <SelectValue>{name(locale)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {MARKET_LANGUAGES.map((code) => (
              <SelectItem key={code} value={code}>
                {name(code)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <FieldSet className="gap-3" data-invalid={error ? true : undefined}>
        <FieldLegend variant="label">{text.extra}</FieldLegend>
        <FieldDescription>{text.extraHelp}</FieldDescription>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
          {MARKET_LANGUAGES.filter((code) => code !== locale).map((code) => (
            <Field key={code} orientation="horizontal">
              <Checkbox
                id={`market-language-${code}`}
                checked={locales.includes(code)}
                onCheckedChange={(on) => handleExtra(code, on === true)}
              />
              <FieldLabel htmlFor={`market-language-${code}`} className="font-normal">
                {name(code)}
              </FieldLabel>
            </Field>
          ))}
        </div>
        {error ? <FieldError>{error}</FieldError> : null}
      </FieldSet>
    </>
  )
}
