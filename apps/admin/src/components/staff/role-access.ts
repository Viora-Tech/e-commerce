import { type Permission, type Resource, statement } from '@commerce/core/permissions'

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

/** "Select all" grants every permission of the resource (keeping its ticks); "Clear" removes them. */
export function toggleResource(
  access: RoleAccess,
  resource: Resource,
  askEditable: boolean,
): RoleAccess {
  const all = resourcePermissions(resource)
  return all.every((p) => access.granted.includes(p))
    ? apply(access, { off: all }, askEditable)
    : apply(access, { on: all }, askEditable)
}
