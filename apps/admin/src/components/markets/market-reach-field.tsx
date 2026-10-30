'use client'

import { FieldDescription, FieldError, FieldLegend, FieldSet } from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { RadioGroup } from '@commerce/ui/shadcn/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import Link from 'next/link'
import RadioOption from '@/components/fields/radio-option'
import { marketsContent } from '@/data/markets'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import type { DomainOption, MarketAccess, MarketForm } from './market-form'

type ReachPatch = Partial<Pick<MarketForm, 'access' | 'subfolder' | 'subfolderTyped' | 'domainId'>>

type MarketReachFieldProps = {
  access: MarketAccess
  subfolder: string
  domainId: string
  /** The store's main domain, which a subfolder hangs off (`waimers.koomerce.app`). */
  primaryHost: string
  domains: DomainOption[]
  subfolderError: string | undefined
  domainError: string | undefined
  onChange: (patch: ReachPatch) => void
}

/** How shoppers reach the market: a subfolder of the main address, its own domain, or neither. */
export default function MarketReachField({
  access,
  subfolder,
  domainId,
  primaryHost,
  domains,
  subfolderError,
  domainError,
  onChange,
}: MarketReachFieldProps) {
  // Hooks
  const copy = useCopy(marketsContent)

  // Render logic
  const text = copy.dialog.reach
  const picked = domains.find((d) => d.id === domainId)
  const free = domains.filter((d) => !d.usedBy || d.id === domainId)
  const error = access === 'subfolder' ? subfolderError : access === 'domain' ? domainError : null

  return (
    <FieldSet className="gap-3" data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{text.label}</FieldLegend>
      <RadioGroup
        value={access}
        onValueChange={(v) => onChange({ access: v as MarketAccess })}
        className="gap-2"
      >
        <RadioOption
          id="market-reach-subfolder"
          value="subfolder"
          label={text.subfolder}
          help={text.subfolderHelp}
        />
        <RadioOption
          id="market-reach-domain"
          value="domain"
          label={text.domain}
          help={text.domainHelp}
        />
        <RadioOption
          id="market-reach-none"
          value="none"
          label={text.choice}
          help={text.choiceHelp}
        />
      </RadioGroup>
      {access === 'subfolder' ? (
        <InputGroup>
          <InputGroupAddon>
            <InputGroupText className="max-w-[14rem] truncate">{primaryHost}/</InputGroupText>
          </InputGroupAddon>
          <InputGroupInput
            aria-label={text.subfolderLabel}
            value={subfolder}
            maxLength={5}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={subfolderError ? true : undefined}
            onChange={(e) =>
              onChange({ subfolder: e.target.value.toLowerCase(), subfolderTyped: true })
            }
          />
        </InputGroup>
      ) : null}
      {access === 'domain' && free.length > 0 ? (
        <Select value={domainId} onValueChange={(v) => onChange({ domainId: String(v ?? '') })}>
          <SelectTrigger aria-label={text.domainPick} className="w-full">
            <SelectValue>{picked?.hostname ?? text.domainPick}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {domains.map((d) => (
              <SelectItem key={d.id} value={d.id} disabled={Boolean(d.usedBy) && d.id !== domainId}>
                {d.usedBy && d.id !== domainId
                  ? `${d.hostname} · ${text.domainUsed(d.usedBy)}`
                  : d.hostname}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {access === 'domain' && free.length === 0 ? (
        <FieldDescription>
          {text.domainNone}{' '}
          <Link href={routes.settings.domains()} className="font-medium underline">
            {text.domainsLink}
          </Link>
        </FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
