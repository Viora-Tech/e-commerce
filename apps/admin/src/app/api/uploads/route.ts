import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { LOCAL_UPLOAD_DIR } from '@commerce/core'
import { resolveStoreForOrganization } from '@commerce/db'
import { isAllowedContentType, keyBelongsToStore, MAX_UPLOAD_BYTES } from '@commerce/storage'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * The local storage provider's upload target (development only). The
 * browser PUTs here with the key the presign step chose; we check the
 * session, that the key belongs to the caller's store, and write the bytes
 * under `public/uploads` so Next serves them. R2 never touches this route.
 */
export async function PUT(request: Request) {
  const session = await auth().api.getSession({ headers: request.headers })
  const organizationId = (session?.session as { activeOrganizationId?: string | null } | undefined)
    ?.activeOrganizationId
  if (!session || !organizationId) return new Response('Unauthorized', { status: 401 })
  const storeId = await resolveStoreForOrganization(db(), organizationId)
  if (!storeId) return new Response('No store', { status: 403 })

  const key = new URL(request.url).searchParams.get('key') ?? ''
  if (!keyBelongsToStore(key, storeId)) return new Response('Forbidden key', { status: 403 })
  const contentType = request.headers.get('content-type') ?? ''
  if (!isAllowedContentType(contentType)) return new Response('Unsupported type', { status: 415 })

  const bytes = new Uint8Array(await request.arrayBuffer())
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_UPLOAD_BYTES) {
    return new Response('Bad size', { status: 413 })
  }
  const path = join(process.cwd(), LOCAL_UPLOAD_DIR, key)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, bytes)
  return new Response(null, { status: 204 })
}
