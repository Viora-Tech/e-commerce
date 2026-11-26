import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Separator } from '@commerce/ui/shadcn/separator'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import ProgramDetails from '@/components/affiliate-portal/program-details'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import { portalStore, requireAffiliate } from '@/lib/affiliate-portal'
import { loadAffiliatePortal } from '@/lib/affiliates'

type GuidePageProps = { params: Promise<{ storeId: string }> }

const copy = affiliatePortalContent.guide

export const metadata: Metadata = { title: copy.metaTitle }

/**
 * Guide: the store's own words about its program (the program's pitch, set in the admin), our
 * getting-started steps with the tips beside them in one card (so no short card leaves a hole),
 * then the program's rules and terms.
 */
export default async function GuidePage({ params }: GuidePageProps) {
  // Hooks
  const { storeId } = await params
  const { me } = await requireAffiliate(storeId)
  const [portal, store] = await Promise.all([
    loadAffiliatePortal(storeId, me),
    portalStore(storeId),
  ])

  // Early returns
  if (!portal) notFound()

  // Render logic
  const p = portal.program
  return (
    <div className="flex flex-col gap-4 px-4 lg:px-6">
      <Card>
        <CardHeader>
          <CardTitle>{copy.title}</CardTitle>
          <CardDescription>{copy.welcome(store.name)}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 text-sm @3xl/main:grid-cols-[3fr_auto_2fr]">
          <div className="flex flex-col gap-4">
            {p.pitch ? <p className="whitespace-pre-line">{p.pitch}</p> : null}
            <ol className="flex list-decimal flex-col gap-3 pl-5">
              {copy.steps.map((s) => (
                <li key={s.title}>
                  <span className="font-medium">{s.title}.</span>{' '}
                  <span className="text-muted-foreground">{s.body}</span>
                </li>
              ))}
            </ol>
          </div>
          <Separator orientation="vertical" className="hidden @3xl/main:block" />
          <Separator className="@3xl/main:hidden" />
          <div className="flex flex-col gap-3">
            <h2 className="font-medium">{copy.tipsTitle}</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5 text-muted-foreground">
              {copy.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.terms}</CardTitle>
        </CardHeader>
        <CardContent>
          <ProgramDetails program={p} withTerms />
        </CardContent>
      </Card>
    </div>
  )
}
