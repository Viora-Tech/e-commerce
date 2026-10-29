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
import { platformContent } from '@/data/platform'
import { getCopy } from '@/lib/copy-server'
import { appRouter, call } from '@/lib/api'
import { platformCallOptions } from '@/lib/platform-access'
import { pageParam, textParam } from '@/lib/platform-params'
import { routes } from '@/lib/routes'

type UsersPageProps = { searchParams: Promise<Record<string, string | string[] | undefined>> }

/** Platform console → Users: every admin user, their stores and roles (staff only). */
export default async function PlatformUsersPage({ searchParams }: UsersPageProps) {
  const sp = await searchParams
  const q = textParam(sp.q)
  const page = pageParam(sp.page)
  const list = await call(
    appRouter.platform.users.list,
    { search: q, page },
    await platformCallOptions(),
  )
  const copy = await getCopy(platformContent)
  const t = copy.users
  const base = routes.platform.users()

  return (
    <PageBody>
      <PageHeader title={t.title} summary={copy.notice} />
      <DataCard title={t.title} count={list.total} flush>
        <PlatformFilters
          action={base}
          fields={[{ name: 'q', value: q, placeholder: t.searchPlaceholder }]}
          clearHref={base}
        />
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.columns.user}</TableHead>
              <TableHead>{t.columns.stores}</TableHead>
              <TableHead>{t.columns.created}</TableHead>
              <TableHead>{t.columns.lastSignIn}</TableHead>
              <TableHead>{t.columns.passkey}</TableHead>
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
              list.rows.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-strong">{u.name}</span>
                      <span className="truncate text-caption text-muted-foreground">{u.email}</span>
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-normal">
                    {u.stores.length === 0 ? (
                      <span className="text-muted-foreground">{t.noStores}</span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {u.stores.map((s) => (
                          <Link
                            key={s.storeId}
                            href={routes.platform.store(s.storeId)}
                            className="hover:underline"
                          >
                            <StatusChip tone={s.status === 'active' ? 'neutral' : 'attention'}>
                              {s.name} · {s.role}
                            </StatusChip>
                          </Link>
                        ))}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <RelativeTime value={u.createdAt} />
                  </TableCell>
                  <TableCell>
                    {u.lastSignInAt ? (
                      <span className="flex flex-col">
                        <RelativeTime value={u.lastSignInAt} />
                        <span className="text-caption text-muted-foreground">
                          {u.lastSignInMethod}
                        </span>
                      </span>
                    ) : (
                      copy.dash
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip tone={u.passkey ? 'success' : 'neutral'}>
                      {u.passkey ? t.on : t.off}
                    </StatusChip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
        <PlatformPager
          base={base}
          params={{ q }}
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
        />
      </DataCard>
    </PageBody>
  )
}
