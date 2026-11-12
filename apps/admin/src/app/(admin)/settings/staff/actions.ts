'use server'

import { revalidatePath } from 'next/cache'
import { getSession } from '@/lib/auth'

/**
 * After a role is saved or deleted: drop every cached copy of the Staff pages (the roles list and
 * each role page), on the server and in the browser's router cache, so the next visit reads what
 * is saved (#1623). The save itself goes through `api.staff`, which checks the member's rights.
 */
export async function revalidateStaff(): Promise<void> {
  if (!(await getSession())) return
  revalidatePath('/settings/staff', 'layout')
}
