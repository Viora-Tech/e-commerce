import { isPlanId } from '@commerce/core/billing'
import { PLATFORM_STORE_STATES } from '@commerce/core/platform'
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
import StatusChip from '@/components/layout/status-chip'
import PlatformFilters from '@/components/platform/platform-filters'
import PlatformPager from '@/components/platform/platform-pager'
import PlatformTabs from '@/components/platform/platform-tabs'
import { billingContent } from '@/data/billing'
import { platformContent } from '@/data/platform'
import { appRouter, call } from '@/lib/api'
import { getCopy } from '@/lib/copy-server'
import { formatPaise } from '@/lib/money'
import { platformCallOptions } from '@/lib/platform-access'
import { planTone } from '@/lib/platform-display'
import { oneOf, pageParam, platformHref, textParam } from '@/lib/platform-params'
import { routes } from '@/lib/routes'

type StoresPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Platform console → Stores: every store on the platform, searchable (staff only). */
export default async function PlatformStoresPage({ searchParams }: StoresPageProps) {
  const sp = await searchParams
  const q = textParam(sp.q)
  const state = oneOf(sp.state, PLATFORM_STORE_STATES)
  const page = pageParam(sp.page)
  const list = await call(
    appRouter.platform.stores.list,
    { search: q, state, page },
    await platformCallOptions(),
  )
  const copy = await getCopy(platformContent)
  const t = copy.stores
  const base = routes.platform.stores()
  const tabs = [
    { label: t.allStates, href: platformHref(base, { q }), active: !state },
    ...PLATFORM_STORE_STATES.map((s) => ({
      label: t.states[s],
      href: platformHref(base, { q, state: s }),
      active: state === s,
    })),
  ]

  return (
    <PageBody>
      <PageHeader title={t.title} summary={copy.notice} />
      <DataCard title={t.title} count={list.total} flush>
        <PlatformTabs items={tabs} />
        <PlatformFilters
          action={base}
          fields={[{ name: 'q', value: q, placeholder: t.searchPlaceholder }]}
          keep={{ state }}
          clearHref={platformHref(base, { state })}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.store}</TableHead>
              <TableHead>{t.columns.owner}</TableHead>
              <TableHead>{t.columns.plan}</TableHead>
              <TableHead>{t.columns.created}</TableHead>
              <TableHead>{t.columns.lastActive}</TableHead>
              <TableHead className="text-right">{t.columns.orders}</TableHead>
              <TableHead className="text-right">{t.columns.gmv}</TableHead>
              <TableHead className="text-right">{t.columns.apps}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-muted-foreground">
                  {t.empty}
                </TableCell>
              </TableRow>
            ) : (
              list.rows.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Link
                      href={routes.platform.store(s.id)}
                      className="flex min-w-0 flex-col hover:underline"
                    >
                      <span className="truncate text-body-strong text-foreground">{s.name}</span>
                      <span className="truncate text-caption text-muted-foreground">
                        {s.domain ?? s.slug}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-56 truncate">{s.ownerEmail ?? copy.dash}</TableCell>
                  <TableCell>
                    {s.plan ? (
                      <StatusChip tone={planTone(s.planStatus)}>
                        {isPlanId(s.plan) ? billingContent.plans[s.plan].name : s.plan}
                        {s.planStatus ? ` · ${s.planStatus}` : ''}
                      </StatusChip>
                    ) : (
                      <span className="text-muted-foreground">{t.states.none}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RelativeTime value={s.createdAt} />
                  </TableCell>
                  <TableCell>
                    {s.lastActiveAt ? <RelativeTime value={s.lastActiveAt} /> : copy.dash}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.orders30d}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(s.gmv30dPaise)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.appsInstalled}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PlatformPager
          base={base}
          params={{ q, state }}
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
        />
      </DataCard>
    </PageBody>
  )
}
