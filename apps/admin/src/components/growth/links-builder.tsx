'use client'

import { CheckIcon, Copy } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import {
  growthLinksContent as copy,
  growthOverviewContent,
  LINK_PLACEMENTS,
  type LinkPlacementId,
} from '@/data/growth'
import { routes } from '@/lib/routes'

type LinksBuilderProps = { storefrontOrigin: string }

const PLACEMENT_OPTIONS = Object.fromEntries(LINK_PLACEMENTS.map((p) => [p.id, p.label]))

/** Builds a UTM-tagged storefront link for wherever the merchant will share it. */
function buildLink(origin: string, page: string, placementId: LinkPlacementId, campaign: string) {
  const placement = LINK_PLACEMENTS.find((p) => p.id === placementId)
  if (!placement) return null
  let url: URL
  try {
    url = new URL(page.trim() || '/', origin)
  } catch {
    return null
  }
  url.searchParams.set('utm_source', placement.source)
  url.searchParams.set('utm_medium', placement.medium)
  const name = campaign.trim().toLowerCase().replace(/\s+/g, '-')
  if (name) url.searchParams.set('utm_campaign', name)
  return url.toString()
}

/** UTM link builder: pick a page, pick where you will share it, get a tagged link to copy. */
export default function LinksBuilder({ storefrontOrigin }: LinksBuilderProps) {
  // Hooks
  const [page, setPage] = useState('/')
  const [placementId, setPlacementId] = useState<LinkPlacementId>(LINK_PLACEMENTS[0].id)
  const [campaign, setCampaign] = useState('')
  const [copied, setCopied] = useState(false)

  // Event handlers
  const handleCopy = async () => {
    const current = buildLink(storefrontOrigin, page, placementId, campaign)
    if (!current) return
    try {
      await navigator.clipboard.writeText(current)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the value is selectable in the box.
    }
  }

  // Render logic
  const link = buildLink(storefrontOrigin, page, placementId, campaign)

  return (
    <div className="mx-auto flex w-full max-w-[75rem] flex-col gap-5 px-4 py-6 md:px-8 md:py-8">
      <ProoflyPageHeader
        title={copy.title}
        summary={copy.intro}
        back={{ label: growthOverviewContent.title, href: routes.growth.home() }}
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <CardContent>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="link-page">{copy.form.pageLabel}</FieldLabel>
                <Input
                  id="link-page"
                  size="lg"
                  value={page}
                  placeholder={copy.form.pagePlaceholder}
                  onChange={(e) => setPage(e.target.value)}
                />
                <p className="text-caption text-muted-foreground">{copy.form.pageHelp}</p>
              </Field>
              <Field>
                <FieldLabel htmlFor="link-placement">{copy.form.placementLabel}</FieldLabel>
                <Select
                  items={PLACEMENT_OPTIONS}
                  value={placementId}
                  onValueChange={(v) => setPlacementId(v as LinkPlacementId)}
                >
                  <SelectTrigger id="link-placement" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LINK_PLACEMENTS.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="link-campaign">{copy.form.campaignLabel}</FieldLabel>
                <Input
                  id="link-campaign"
                  size="lg"
                  value={campaign}
                  maxLength={40}
                  placeholder={copy.form.campaignPlaceholder}
                  onChange={(e) => setCampaign(e.target.value)}
                />
                <p className="text-caption text-muted-foreground">{copy.form.campaignHelp}</p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.result.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {link ? (
              <div className="flex gap-2">
                <Input readOnly size="lg" value={link} className="font-mono text-caption" />
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="shrink-0 gap-1.5"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <CheckIcon aria-hidden="true" className="size-4" />
                  ) : (
                    <Copy aria-hidden="true" className="size-4" />
                  )}
                  {copied ? copy.result.copied : copy.result.copy}
                </Button>
              </div>
            ) : (
              <p className="text-body text-muted-foreground">{copy.result.empty}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
