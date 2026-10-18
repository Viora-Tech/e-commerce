import { Palette } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { Metadata } from 'next'
import Link from 'next/link'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import SectionEmpty from '@/components/layout/section-empty'
import ImportReportPages from '@/components/themes/import-report-pages'
import ImportReportSections from '@/components/themes/import-report-sections'
import ImportReportSummary from '@/components/themes/import-report-summary'
import ImportReportSwaps from '@/components/themes/import-report-swaps'
import ImportReportTodo from '@/components/themes/import-report-todo'
import { previewUrl } from '@/components/themes/theme-types'
import { themeImportContent } from '@/data/theme-import'
import { themesContent } from '@/data/themes'
import { appRouter, call, serverContext } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'
import { storefrontOrigin } from '@/lib/storefront-origin'

type Props = { params: Promise<{ id: string }> }

export const metadata: Metadata = { title: 'Import report' }

/** Online Store › Themes › <theme> › Import report: what happened to each part of a Shopify theme. */
export default async function Page({ params }: Props) {
  const { id } = await params
  const copy = (await getCopy(themeImportContent)).report
  const context = await serverContext()
  const [found, theme] = await Promise.all([
    call(appRouter.themes.import.report, { id }, { context }).catch(() => null),
    call(appRouter.themes.get, { id }, { context }).catch(() => null),
  ])
  if (!found || !theme) {
    return <SectionEmpty {...themesContent.unavailable} body={copy.notFound} icon={Palette} />
  }
  const { report } = found
  const origin = await storefrontOrigin()

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle(theme.name, found.fileName)}
        back={{ label: copy.back, href: routes.onlineStore.themes() }}
        actions={
          <>
            <Button
              variant="outline"
              nativeButton={false}
              render={
                <a href={previewUrl(origin, theme.previewToken)} target="_blank" rel="noreferrer" />
              }
            >
              {copy.preview}
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={routes.onlineStore.themeEditor(theme.id)} />}
            >
              {copy.customize}
            </Button>
          </>
        }
      />
      <p className="max-w-3xl text-body text-muted-foreground">{copy.intro}</p>
      <ImportReportSummary copy={copy} imported={report.imported} all={report.all} />
      <ImportReportTodo copy={copy} report={report} />
      <ImportReportSwaps copy={copy} swaps={report.swaps} />
      <ImportReportSections copy={copy} sections={report.sections} />
      <ImportReportPages copy={copy} templates={report.templates} />
    </PageBody>
  )
}
