import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { authorizeLocalUpload, localStoragePath } from '@commerce/core'
import { resolveStoreForOrganization, withStore } from '@commerce/db'
import { isAllowedContentType, keyBelongsToStore } from '@commerce/storage'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { rateLimited } from '@/lib/rate-limit'
import { readCappedBody } from '@/lib/read-capped-body'
import { withEvlog } from '@/lib/request-log'

/** Per organisation: generous enough for a bulk media import, tight enough to stop a runaway script. */
const UPLOAD_RULE = { limit: 60, windowMs: 5 * 60_000 }

/**
 * The local storage provider's upload target (the built-in default when no
 * storage Connection is installed). The browser PUTs here with the key the
 * presign step chose; we check the session, that the member may write content,
 * that the key is one of the store's pending uploads with the same type, and the
 * size (while reading, never after), then write the bytes under `LOCAL_STORAGE_DIR` (default
 * `./.data/uploads`, gitignored). Reads go through `/uploads/[...key]`,
 * never Next's static `public/` serving. R2 and other connections never
 * touch this route.
 */
export const PUT = withEvlog(async (request: Request) => {
  const session = await auth().api.getSession({ headers: request.headers })
  const organizationId = (session?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId
  if (!session || !organizationId) return new Response('Unauthorized', { status: 401 })
  const storeId = await resolveStoreForOrganization(db(), organizationId)
  if (!storeId) return new Response('No store', { status: 403 })

  const limit = await rateLimited('uploads:org', organizationId, UPLOAD_RULE)
  if (!limit.ok) return new Response('Too many uploads', { status: 429 })

  const key = new URL(request.url).searchParams.get('key') ?? ''
  if (!keyBelongsToStore(key, storeId)) return new Response('Forbidden key', { status: 403 })
  const contentType = request.headers.get('content-type') ?? ''
  if (!isAllowedContentType(contentType)) return new Response('Unsupported type', { status: 415 })

  const allowed = await withStore(db(), storeId, (tx) =>
    authorizeLocalUpload(tx, { storeId, userId: session.user.id, key, contentType }),
  )
  if (!allowed.ok) return new Response('Not allowed', { status: allowed.status })

  const body = await readCappedBody(request, allowed.maxBytes)
  if (!body.ok) return new Response('Bad size', { status: 413 })
  const path = localStoragePath(key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, body.bytes)
  return new Response(null, { status: 204 })
})
