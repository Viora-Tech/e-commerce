'use client'

import type { WhatsappTemplateRef } from '@commerce/core/marketing'
import { Alert, AlertDescription } from '@commerce/ui/shadcn/alert'
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
import Link from 'next/link'
import { campaignEditorContent } from '@/data/marketing-campaigns'
import type { api } from '@/lib/api-client'

export type TemplatesResult = Awaited<ReturnType<typeof api.marketing.campaigns.whatsappTemplates>>
type Template = Extract<TemplatesResult, { ok: true }>['templates'][number]

type WhatsappTemplateCardProps = {
  value: WhatsappTemplateRef | null
  templates: TemplatesResult | null
  onChange: (value: WhatsappTemplateRef | null) => void
}

const copy = campaignEditorContent.whatsapp
const keyOf = (t: { name: string; language: string }) => `${t.name}|${t.language}`

function problemText(t: Exclude<TemplatesResult, { ok: true }>): string {
  if (t.reason === 'no_channel') return campaignEditorContent.channel.noWhatsapp
  if (t.reason === 'error') return copy.error(t.message ?? '')
  return copy.none
}

/** Approved-template picker with one input per {{n}} placeholder. */
export default function WhatsappTemplateCard({
  value,
  templates,
  onChange,
}: WhatsappTemplateCardProps) {
  // Event handlers
  const handlePick = (key: string) => {
    if (!templates?.ok) return
    const t = templates.templates.find((x) => keyOf(x) === key)
    if (!t) return
    const variables = Array.from({ length: t.variableCount }, (_, i) => value?.variables[i] ?? '')
    onChange({ name: t.name, language: t.language, variables })
  }

  const handleVariable = (i: number, text: string) => {
    if (!value) return
    const variables = [...value.variables]
    variables[i] = text
    onChange({ ...value, variables })
  }

  // Render logic
  const list: Template[] = templates?.ok ? templates.templates : []
  const chosen = value ? list.find((t) => keyOf(t) === keyOf(value)) : undefined
  const count = chosen?.variableCount ?? value?.variables.length ?? 0
  const items = Object.fromEntries(list.map((t) => [keyOf(t), `${t.name} (${t.language})`]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          {templates && !templates.ok ? (
            <Alert>
              <AlertDescription>
                {problemText(templates)}{' '}
                <Link href="/settings/notifications" className="underline">
                  {campaignEditorContent.channel.settings}
                </Link>
              </AlertDescription>
            </Alert>
          ) : null}
          <Field>
            <FieldLabel htmlFor="wa-template">{copy.template}</FieldLabel>
            <Select
              items={items}
              value={value ? keyOf(value) : null}
              onValueChange={(v) => v && handlePick(String(v))}
              disabled={list.length === 0}
            >
              <SelectTrigger id="wa-template" className="w-full">
                <SelectValue
                  placeholder={value ? `${value.name} (${value.language})` : copy.pick}
                />
              </SelectTrigger>
              <SelectContent>
                {list.map((t) => (
                  <SelectItem key={keyOf(t)} value={keyOf(t)}>
                    {t.name}
                    <span className="ml-2 text-muted-foreground">
                      {t.language} · {copy.category(t.category)}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldDescription>{copy.help}</FieldDescription>
          </Field>
          {value && count > 0 ? (
            <Field>
              <FieldLabel>{copy.variables}</FieldLabel>
              <div className="flex flex-col gap-2">
                {Array.from({ length: count }, (_, i) => (
                  <Input
                    // biome-ignore lint/suspicious/noArrayIndexKey: placeholders are positional
                    key={i}
                    aria-label={copy.variable(i + 1)}
                    placeholder={copy.variable(i + 1)}
                    value={value.variables[i] ?? ''}
                    onChange={(e) => handleVariable(i, e.target.value)}
                  />
                ))}
              </div>
              <FieldDescription>{copy.variableHelp}</FieldDescription>
            </Field>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  )
}
