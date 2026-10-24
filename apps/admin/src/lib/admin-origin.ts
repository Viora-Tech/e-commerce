import 'server-only'
import { loadEnv } from '@commerce/config'

/**
 * The admin's public origin (`ADMIN_URL`), for redirects that leave a route handler. Behind the
 * proxy `req.nextUrl.origin` is the container's own bind address (`https://0.0.0.0:3200`), so
 * OAuth callbacks must never build their way back from it.
 */
export const adminUrl = (path: string) =>
  new URL(path, loadEnv(process.env).ADMIN_URL.replace(/\/+$/, ''))
