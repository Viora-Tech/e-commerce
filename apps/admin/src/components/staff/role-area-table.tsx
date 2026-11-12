'use client'

import { type Permission, RESOURCE_METADATA, type Resource } from '@commerce/core/permissions'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { staffContent } from '@/data/staff'
import { useCopy } from '@/hooks/use-copy'
import { LEVEL_FILL } from './level-tone'
import {
  areaActionChanges,
  askable,
  canPick,
  type EditRules,
  type Level,
  levelOf,
  pickAreaLevel,
  pickLevel,
  type RoleAccess,
  resourcePermissions,
} from './role-access'

type RoleAreaTableProps = {
  resource: Resource
  value: RoleAccess
  onChange: (next: RoleAccess) => void
  rules: EditRules
}

type LevelRadioProps = {
  name: string
  level: Level
  label: string
  checked: boolean
  disabled: boolean
  onPick: (level: Level) => void
}

/* Permission name, then one fixed column per level, so every row's dots line up. */
const GRID_ASK =
  'grid grid-cols-[minmax(0,1fr)_repeat(3,3.75rem)] items-center sm:grid-cols-[minmax(0,1fr)_repeat(3,5.5rem)]'
const GRID_NO_ASK =
  'grid grid-cols-[minmax(0,1fr)_repeat(2,3.75rem)] items-center sm:grid-cols-[minmax(0,1fr)_repeat(2,5.5rem)]'

/** `orders.refund` reads as "Refund" under its area; `manage_types` as "Manage types". */
function actionLabel(permission: Permission, resource: Resource): string {
  const words = permission.slice(resource.length + 1).replaceAll('_', ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * One area of the role page (Orders, Products, …) as a table: a row per permission and one radio
 * column each for Off, Allowed and Ask first, exactly one filled dot per row. Rows that can never
 * ask (reads, approving) show "–" under Ask first. Quick actions set the whole area within the
 * same rules as the rows (`role-access.ts`).
 */
export default function RoleAreaTable({ resource, value, onChange, rules }: RoleAreaTableProps) {
  // Hooks
  const copy = useCopy(staffContent)

  // Event handlers
  const handlePick = (permission: Permission, level: Level) =>
    onChange(pickLevel(value, permission, level, rules))

  const handleArea = (level: Level) => onChange(pickAreaLevel(value, resource, level, rules))

  // Render logic
  const meta = RESOURCE_METADATA[resource]
  const rows = resourcePermissions(resource)
  const showAskColumn = rules.showAsk
  const grid = showAskColumn ? GRID_ASK : GRID_NO_ASK
  const columns: { level: Level; label: string }[] = [
    { level: 'off', label: copy.roleForm.off },
    { level: 'allowed', label: copy.roleForm.allowed },
    ...(showAskColumn ? [{ level: 'ask' as const, label: copy.roleForm.askFirst }] : []),
  ]
  const headingId = `area-${resource}`
  const actions: { level: Level; label: string; shown: boolean }[] = [
    {
      level: 'allowed',
      label: copy.roleForm.allowAll,
      shown: !rules.grantsLocked || rules.askEditable,
    },
    {
      level: 'ask',
      label: copy.roleForm.askAll,
      shown: rules.askEditable && rows.some((p) => askable(p, rules.showAsk)),
    },
    { level: 'off', label: copy.roleForm.offAll, shown: !rules.grantsLocked },
  ]
  const shownActions = actions.filter((a) => a.shown)

  return (
    <section aria-labelledby={headingId} className="flex flex-col rounded-xl surface-card">
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 pt-4 pb-3 md:px-6">
        <div className="min-w-0">
          <h3 id={headingId} className="text-body font-semibold text-ink-strong">
            {meta.label}
          </h3>
          <p className="text-caption text-muted-foreground">{meta.description}</p>
        </div>
        {shownActions.length > 0 ? (
          <div className="-mr-2 flex flex-wrap gap-1">
            {shownActions.map((a) => (
              <Button
                key={a.level}
                type="button"
                variant="ghost"
                size="sm"
                disabled={!areaActionChanges(value, resource, a.level, rules)}
                onClick={() => handleArea(a.level)}
              >
                {a.label}
              </Button>
            ))}
          </div>
        ) : null}
      </header>
      <div
        aria-hidden="true"
        className={cn(
          grid,
          'h-9 border-y border-line bg-muted/50 px-4 text-caption font-medium text-muted-foreground md:px-6',
        )}
      >
        <span>{copy.roleForm.permission}</span>
        {columns.map((c) => (
          <span key={c.level} className="text-center leading-tight">
            {c.label}
          </span>
        ))}
      </div>
      <div className="flex flex-col divide-y divide-line">
        {rows.map((permission) => {
          const action = actionLabel(permission, resource)
          const level = levelOf(value, permission, rules.showAsk)
          const labelId = `perm-${permission}`
          return (
            <div
              key={permission}
              role="radiogroup"
              aria-labelledby={`${headingId} ${labelId}`}
              className={cn(grid, 'min-h-11 px-4 md:px-6')}
            >
              <span id={labelId} className="min-w-0 truncate py-2 text-body text-foreground">
                {action}
              </span>
              {columns.map((c) =>
                c.level === 'ask' && !askable(permission, rules.showAsk) ? (
                  <span
                    key={c.level}
                    className="flex h-11 items-center justify-center text-muted-foreground"
                  >
                    <span aria-hidden="true">–</span>
                    <span className="sr-only">{copy.roleForm.neverAsks}</span>
                  </span>
                ) : (
                  <LevelRadio
                    key={c.level}
                    name={permission}
                    level={c.level}
                    label={c.label}
                    checked={level === c.level}
                    disabled={!canPick(value, permission, c.level, rules)}
                    onPick={(picked) => handlePick(permission, picked)}
                  />
                ),
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** A native radio (arrow keys move within the row) drawn as a dot: filled in the level's colour. */
function LevelRadio({ name, level, label, checked, disabled, onPick }: LevelRadioProps) {
  return (
    <label
      className={cn(
        'group/radio flex h-11 items-center justify-center',
        disabled ? 'cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <input
        type="radio"
        name={name}
        value={level}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={() => onPick(level)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className={cn(
          'flex size-5 items-center justify-center rounded-full border-2 transition-[background-color,border-color] duration-150 ease-out peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card motion-reduce:transition-none',
          checked ? LEVEL_FILL[level] : 'border-input bg-card',
          !checked && !disabled && 'group-hover/radio:border-muted-foreground',
          !checked && disabled && 'opacity-40',
        )}
      >
        {checked ? <span className="size-2 rounded-full bg-card" /> : null}
      </span>
    </label>
  )
}
