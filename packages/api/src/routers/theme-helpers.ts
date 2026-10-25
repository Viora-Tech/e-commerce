import { ThemeLibraryError } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'

export const IdInput = z.object({ id: z.string().uuid() })

/** Theme library failures as the API's NOT_FOUND / BAD_REQUEST. */
export async function libraryErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof ThemeLibraryError) {
      const code = err.code === 'THEME_NOT_FOUND' ? 'NOT_FOUND' : 'BAD_REQUEST'
      throw new ORPCError(code, { message: err.message })
    }
    throw err
  }
}

/** The member saving, as "Last saved by" shows them: their name, else their email. */
export const savedBy = (context: { session: { user: { name?: string | null; email: string } } }) =>
  context.session.user.name?.trim() || context.session.user.email
