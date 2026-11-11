import { currentRequest } from './request-context'

/**
 * `next/headers` for code shared with the Next storefront: the same two reads, answered from
 * this server's request context. Writes (`cookies().set`) are not allowed while a page renders
 * in Next either, so they throw here too.
 */

export async function headers(): Promise<Headers> {
  return currentRequest().headers
}

type Cookie = { name: string; value: string }

function parse(header: string | null): Map<string, string> {
  const out = new Map<string, string>()
  if (!header) return out
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq <= 0) continue
    const name = part.slice(0, eq).trim()
    const raw = part.slice(eq + 1).trim()
    try {
      out.set(name, decodeURIComponent(raw))
    } catch {
      out.set(name, raw)
    }
  }
  return out
}

export async function cookies() {
  const jar = parse(currentRequest().headers.get('cookie'))
  return {
    get: (name: string): Cookie | undefined => {
      const value = jar.get(name)
      return value === undefined ? undefined : { name, value }
    },
    getAll: (): Cookie[] => [...jar].map(([name, value]) => ({ name, value })),
    has: (name: string) => jar.has(name),
    set: () => {
      throw new Error('cookies().set is not available while a page renders')
    },
    delete: () => {
      throw new Error('cookies().delete is not available while a page renders')
    },
    get size() {
      return jar.size
    },
  }
}

/** Never in a draft-mode preview on this server. */
export async function draftMode() {
  return { isEnabled: false, enable: () => undefined, disable: () => undefined }
}
