import { PLATFORM_AUDIT_SOURCES } from '@commerce/core/platform'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import PlatformFilters from '@/components/platform/platform-filters'
import PlatformPager from '@/components/platform/platform-pager'
import PlatformTabs from '@/components/platform/platform-tabs'
import { platformContent } from '@/data/platform'
import { appRouter, call } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { platformCallOptions } from '@/lib/platform-access'
import {
  dayParam,
  oneOf,
  pageParam,
  platformHref,
  textParam,
  uuidParam,
} from '@/lib/platform-params'
import { routes } from '@/lib/routes'

type AuditPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Platform console → Audit log: console reads and store events, by store, actor and date (staff only). */
export default async function PlatformAuditPage({ searchParams }: AuditPageProps) {
  const sp = await searchParams
  const source = oneOf(sp.source, PLATFORM_AUDIT_SOURCES) ?? 'console'
  const store = uuidParam(sp.store)
  const actor = textParam(sp.actor)
  const fromDay = textParam(sp.from)
  const toDay = textParam(sp.to)
  const page = pageParam(sp.page)
  const list = await call(
    appRouter.platform.audit.list,
    {
      source,
      storeId: store,
      actor,
      from: dayParam(sp.from),
      to: dayParam(sp.to, 1),
      page,
    },
    await platformCallOptions(),
  )
  const copy = await getCopy(platformContent)
  const t = copy.audit
  const base = routes.platform.audit()
  const filters = { store, actor, from: fromDay, to: toDay }
  const tabs = PLATFORM_AUDIT_SOURCES.map((s) => ({
    label: t.sources[s],
    href: platformHref(base, { ...filters, source: s === 'console' ? undefined : s }),
    active: source === s,
  }))
  const keepSource = source === 'console' ? undefined : source

  return (
    <PageBody>
      <PageHeader title={t.title} summary={copy.notice} />
      <DataCard title={t.title} count={list.total} flush>
        <PlatformTabs items={tabs} />
        <PlatformFilters
          action={base}
          keep={{ source: keepSource }}
          clearHref={platformHref(base, { source: keepSource })}
          fields={[
            { name: 'actor', value: actor, placeholder: t.actorPlaceholder },
            { name: 'store', value: store, placeholder: t.storePlaceholder },
            { name: 'from', value: fromDay, label: t.from, type: 'date' },
            { name: 'to', value: toDay, label: t.to, type: 'date' },
          ]}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.when}</TableHead>
              <TableHead>{t.columns.actor}</TableHead>
              <TableHead>{t.columns.action}</TableHead>
              <TableHead>{t.columns.store}</TableHead>
              <TableHead>{t.columns.detail}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  {t.empty}
                </TableCell>
              </TableRow>
            ) : (
              list.rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <RelativeTime value={r.at} />
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{r.actorEmail ?? copy.dash}</TableCell>
                  <TableCell className="font-mono text-caption">{r.action}</TableCell>
                  <TableCell>
                    {r.storeId ? (
                      <Link href={routes.platform.store(r.storeId)} className="hover:underline">
                        {r.storeName ?? r.storeId}
                      </Link>
                    ) : (
                      copy.dash
                    )}
                  </TableCell>
                  <TableCell className="max-w-80 truncate text-caption text-muted-foreground">
                    {r.detail ?? copy.dash}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PlatformPager
          base={base}
          params={{ ...filters, source: keepSource }}
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
        />
      </DataCard>
    </PageBody>
  )
}
