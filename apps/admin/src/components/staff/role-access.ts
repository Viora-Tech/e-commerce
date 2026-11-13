import {
  canNeedApproval,
  type Permission,
  type Resource,
  statement,
} from '@commerce/core/permissions'

/** A role's grants and which of them ask first ("Needs approval"). */
export type RoleAccess = { granted: Permission[]; asks: Permission[] }

/** One permission row's choice in the role editor. */
export type Level = 'off' | 'allowed' | 'ask'

export function resourcePermissions(resource: Resource): Permission[] {
  return (statement[resource] as readonly string[]).map((a) => `${resource}.${a}` as Permission)
}

function resourceOf(permission: Permission): Resource {
  return permission.slice(0, permission.indexOf('.')) as Resource
}

/** What a row shows: off, allowed, or ask first (a grant the role ticks). */
export function levelOf(access: RoleAccess, permission: Permission, showAsk: boolean): Level {
  if (!access.granted.includes(permission)) return 'off'
  return showAsk && access.asks.includes(permission) ? 'ask' : 'allowed'
}

type Change = { on?: Permission[]; off?: Permission[]; ask?: Permission[]; unask?: Permission[] }

/**
 * Applies a change. Only the owner changes Ask first (`askEditable`); for anyone else the role's
 * ticks stay as they are, so a grant switched back on still asks, as the server will.
 */
function apply(access: RoleAccess, change: Change, askEditable: boolean): RoleAccess {
  const granted = new Set(access.granted)
  for (const p of change.on ?? []) granted.add(p)
  for (const p of change.off ?? []) granted.delete(p)
  const asks = new Set(access.asks)
  if (askEditable) {
    for (const p of change.ask ?? []) asks.add(p)
    for (const p of [...(change.unask ?? []), ...(change.off ?? [])]) asks.delete(p)
  }
  return { granted: [...granted], asks: [...asks] }
}

/*
 * Every action needs its resource's Read: Fulfil without Read is a role that cannot open the
 * orders it may fulfil. Turning an action on (Allowed or Ask first) turns Read on too; turning
 * Read off turns the resource's other actions off with it.
 */
export function setLevel(
  access: RoleAccess,
  permission: Permission,
  level: Level,
  askEditable: boolean,
): RoleAccess {
  const resource = resourceOf(permission)
  const read = `${resource}.read` as Permission
  const all = resourcePermissions(resource)
  if (level === 'off') {
    return apply(access, { off: permission === read ? all : [permission] }, askEditable)
  }
  const on = all.includes(read) && permission !== read ? [permission, read] : [permission]
  return level === 'ask'
    ? apply(access, { on, ask: [permission] }, askEditable)
    : apply(access, { on, unask: [permission] }, askEditable)
}

/** What the member may change on this role (the same rules the server keeps). */
export type EditRules = {
  /** Grants are fixed: a built-in role, or a member without staff.manage. */
  grantsLocked: boolean
  /** Ask first can be changed: only the owner, and never on the owner role. */
  askEditable: boolean
  /** The owner role never asks, so its rows have no Ask first. */
  showAsk: boolean
}

/** Whether the row of `permission` has an Ask first choice (reads and approving never ask). */
export function askable(permission: Permission, showAsk: boolean): boolean {
  return showAsk && canNeedApproval(permission)
}

/**
 * Whether `level` can be picked on the row of `permission` right now. Built-in roles keep their
 * grants (an off row stays off, an allowed row cannot be switched off); only the owner moves a
 * row into or out of Ask first.
 */
export function canPick(
  access: RoleAccess,
  permission: Permission,
  level: Level,
  rules: EditRules,
): boolean {
  const current = levelOf(access, permission, rules.showAsk)
  if (current === level) return true
  if (level === 'off') return !rules.grantsLocked
  if (rules.grantsLocked && current === 'off') return false
  if (level === 'ask') return askable(permission, rules.showAsk) && rules.askEditable
  return current !== 'ask' || rules.askEditable
}

/**
 * One row's pick, within the rules: a pick that is not allowed leaves the access as it is, and a
 * role whose grants are locked never gains or loses a grant (only its Ask first ticks move).
 */
export function pickLevel(
  access: RoleAccess,
  permission: Permission,
  level: Level,
  rules: EditRules,
): RoleAccess {
  if (levelOf(access, permission, rules.showAsk) === level) return access
  if (!canPick(access, permission, level, rules)) return access
  const next = setLevel(access, permission, level, rules.askEditable)
  return rules.grantsLocked ? { granted: access.granted, asks: next.asks } : next
}

/**
 * An area's quick action ("Allow all", "Ask first for all", "Turn all off"): every row of the
 * resource that may take `level` takes it; rows that cannot (Ask first on a read) stay as they are.
 */
export function pickAreaLevel(
  access: RoleAccess,
  resource: Resource,
  level: Level,
  rules: EditRules,
): RoleAccess {
  let next = access
  for (const permission of resourcePermissions(resource)) {
    if (level === 'ask' && !askable(permission, rules.showAsk)) continue
    next = pickLevel(next, permission, level, rules)
  }
  return next
}

/** Whether an area's quick action would change anything (otherwise its button is disabled). */
export function areaActionChanges(
  access: RoleAccess,
  resource: Resource,
  level: Level,
  rules: EditRules,
): boolean {
  const next = pickAreaLevel(access, resource, level, rules)
  return resourcePermissions(resource).some(
    (p) => levelOf(next, p, rules.showAsk) !== levelOf(access, p, rules.showAsk),
  )
}

/** Every permission on the statement, area by area. */
export function allPermissions(): Permission[] {
  return (Object.keys(statement) as Resource[]).flatMap(resourcePermissions)
}

export type LevelCounts = Record<Level, number>

/** "12 allowed · 5 ask first · 20 off": the role page's summary bar and the roles list. */
export function countLevels(
  access: RoleAccess,
  showAsk: boolean,
  among: readonly Permission[] = allPermissions(),
): LevelCounts {
  const counts: LevelCounts = { off: 0, allowed: 0, ask: 0 }
  for (const p of among) counts[levelOf(access, p, askable(p, showAsk))] += 1
  return counts
}

/**
 * The role editor's React key: the role and what is saved on it. A fresh server read that differs
 * (after a save, a focus refresh, another member's change) mounts a new editor, so the form never
 * keeps showing its copy of the role from before the save (#1623).
 */
export function roleEditorKey(role: {
  id: string
  name: string
  description: string | null
  permissions: readonly string[]
  needsApproval?: readonly string[] | undefined
}): string {
  const sorted = (list: readonly string[] | undefined) => [...(list ?? [])].sort().join(',')
  return [
    role.id,
    role.name,
    role.description ?? '',
    sorted(role.permissions),
    sorted(role.needsApproval),
  ].join('|')
}
