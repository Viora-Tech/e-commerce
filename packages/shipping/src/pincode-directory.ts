/**
 * Server-only loader for the PIN code directory file (see `pincode.ts`). The
 * file is gzipped JSON, read once on first use and kept in memory (about
 * 20,000 PIN codes). No file means no autofill: `loadPincodeDirectory`
 * resolves to null and checkout asks for city and state as before.
 *
 * Where it looks, in order: `PINCODE_DIRECTORY_PATH`, then
 * `packages/shipping/data/pincode-directory.json.gz` from the repo root or
 * from an app folder (`apps/<app>`), which is where the build script writes it.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { gunzipSync } from 'node:zlib'
import { decodePincodeDirectory, type PincodeDirectory } from './pincode'

export const PINCODE_DIRECTORY_FILE = 'packages/shipping/data/pincode-directory.json.gz'

let cached: Promise<PincodeDirectory | null> | null = null

function candidates(): string[] {
  const fromEnv = process.env.PINCODE_DIRECTORY_PATH?.trim()
  const cwd = process.cwd()
  return [
    ...(fromEnv ? [resolve(cwd, fromEnv)] : []),
    resolve(cwd, PINCODE_DIRECTORY_FILE),
    resolve(cwd, '../..', PINCODE_DIRECTORY_FILE),
  ]
}

/** Read and index a directory file. Exposed for the build script and tests. */
export function readPincodeDirectory(path: string): PincodeDirectory {
  const raw = readFileSync(path)
  const json = path.endsWith('.gz') ? gunzipSync(raw).toString('utf8') : raw.toString('utf8')
  return decodePincodeDirectory(JSON.parse(json))
}

/** The directory, or null when no file is installed. A malformed file throws, once per process. */
export function loadPincodeDirectory(): Promise<PincodeDirectory | null> {
  cached ??= Promise.resolve().then(() => {
    const path = candidates().find((p) => existsSync(p))
    return path ? readPincodeDirectory(path) : null
  })
  return cached
}
