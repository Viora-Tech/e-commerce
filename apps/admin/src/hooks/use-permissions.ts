'use client'

import type { Permission } from '@commerce/core/permissions'
import { useEffect, useState } from 'react'
import { api } from '@/lib/api-client'

export type CurrentMember = {
  userId: string
  roleId: string
  roleName: string
  roleSlug: string
  isOwner: boolean
  permissions: Permission[]
}

let cached: Promise<CurrentMember> | null = null

/** One request per page load; the server re-checks every call regardless. */
function load(): Promise<CurrentMember> {
  cached ??= api.staff.me() as Promise<CurrentMember>
  return cached
}

/** Forgets the cached answer after a role change so the next read is fresh. */
export function refreshPermissions(): void {
  cached = null
}

/**
 * What the signed-in member may do, for hiding controls they cannot use.
 * This is a convenience only: `storeProcedure` is the real guard, so a stale
 * or tampered answer here cannot grant access.
 */
export function usePermissions(): {
  member: CurrentMember | null
  loading: boolean
  hasPermission: (permission: Permission) => boolean
} {
  // Hooks
  const [member, setMember] = useState<CurrentMember | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let live = true
    load()
      .then((m) => {
        if (live) setMember(m)
      })
      .catch(() => undefined)
      .finally(() => {
        if (live) setLoading(false)
      })
    return () => {
      live = false
    }
  }, [])

  // Helpers
  const hasPermission = (permission: Permission): boolean => {
    if (!member) return false
    return member.isOwner || member.permissions.includes(permission)
  }

  return { member, loading, hasPermission }
}
