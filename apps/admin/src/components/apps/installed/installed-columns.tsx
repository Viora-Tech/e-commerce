import type { AppSummary } from '@/components/apps/app-card'
import AppLogo from '@/components/apps/app-logo'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { installedAppsContent } from '@/data/installed-apps'
import { accessDetail, accessNames, STATUS_TONE } from '@/lib/app-access'
import type { Formatters } from '@/lib/format'

type Copy = typeof installedAppsContent

const TWO_LINES = 'flex min-w-0 flex-col'
const MAIN = 'truncate text-body text-foreground'
const SUB = 'truncate text-caption text-muted-foreground'

/** "Issued invoice INV-2041" over "12 min ago"; a connection that never connected says so. */
function activityCell(app: AppSummary, copy: Copy) {
  if (app.status === 'needsSetup' && !app.lastActivityAt) {
    return (
      <div className={TWO_LINES}>
        <span className={MAIN}>{copy.activity.notConnected}</span>
        <span className={SUB}>—</span>
      </div>
    )
  }
  if (!app.lastActivityAt) return <span className={SUB}>{copy.activity.none}</span>
  return (
    <div className={TWO_LINES}>
      <span className={MAIN}>{app.problem ?? app.lastActivity ?? copy.activity.generic}</span>
      <RelativeTime value={app.lastActivityAt} className={SUB} />
    </div>
  )
}

/** Columns of the Installed apps table (Figma "Installed apps · List"). */
export function installedColumns(
  copy: Copy,
  fmt: Formatters,
  byline: (app: AppSummary) => string,
): ResourceColumnSpec<AppSummary>[] {
  return [
    {
      id: 'app',
      title: copy.columns.app,
      sortValue: (a) => a.name.toLowerCase(),
      sortLabels: { asc: copy.sort.az, desc: copy.sort.za, first: 'asc' },
      hideable: false,
      className: 'w-[17rem]',
      render: (a) => (
        <div className="flex min-w-0 items-center gap-3">
          <AppLogo id={a.id} icon={a.admin.icon} size={44} className="size-9 rounded-lg" />
          <div className={TWO_LINES}>
            <span className={MAIN}>{a.name}</span>
            <span className={SUB}>{byline(a)}</span>
          </div>
        </div>
      ),
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      className: 'w-[8.75rem]',
      render: (a) =>
        a.status ? (
          <StatusChip tone={STATUS_TONE[a.status]}>{copy.status[a.status]}</StatusChip>
        ) : null,
    },
    {
      id: 'access',
      title: copy.columns.access,
      className: 'w-[14.75rem]',
      render: (a) => (
        <div className={TWO_LINES} title={a.access.resources.map((r) => r.why).join('\n')}>
          <span className={MAIN}>{accessNames(a, copy)}</span>
          <span className={SUB}>{accessDetail(a, copy)}</span>
        </div>
      ),
    },
    {
      id: 'installed',
      title: copy.columns.installed,
      sortValue: (a) => (a.installedAt ? new Date(a.installedAt) : null),
      sortLabels: { desc: copy.sort.newest, asc: copy.sort.oldest },
      className: 'w-[7.75rem]',
      render: (a) =>
        a.installedAt ? (
          <span className={MAIN}>{fmt.date(a.installedAt)}</span>
        ) : (
          <span className={SUB} title={copy.unknownDate}>
            —
          </span>
        ),
    },
    {
      id: 'activity',
      title: copy.columns.activity,
      className: 'w-[14.25rem]',
      render: (a) => activityCell(a, copy),
    },
  ]
}
