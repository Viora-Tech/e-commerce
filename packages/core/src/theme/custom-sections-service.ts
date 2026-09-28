/** SOURCE OF TRUTH: "My sections" storage. WHAT list, save, rename and delete of a store's saved sections in store.preferences.customSections, touching only that key. WHY the Preferences form and the library share one jsonb column and must never overwrite each other. */
import { type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import {
  type CustomSection,
  CustomSectionProblem,
  parseCustomSections,
  prepareCustomSection,
  withCustomSection,
} from './custom-sections'
import { ThemeLibraryError } from './library'

/**
 * "My sections" on the server, under the store's RLS. The list lives in
 * `store.preferences.customSections`; writes touch only that key
 * (`jsonb_set`), so the Online Store preferences form never loses it and it
 * never loses the preferences.
 */

async function readList(tx: StoreTx, storeId: string): Promise<CustomSection[]> {
  const [row] = await tx
    .select({ list: sql<unknown>`${store.preferences} -> 'customSections'` })
    .from(store)
    .where(eq(store.id, storeId))
  return parseCustomSections(row?.list)
}

async function writeList(tx: StoreTx, storeId: string, list: CustomSection[]): Promise<void> {
  await tx
    .update(store)
    .set({
      preferences: sql`jsonb_set(coalesce(${store.preferences}, '{}'::jsonb), '{customSections}', ${JSON.stringify(list)}::jsonb, true)`,
    })
    .where(eq(store.id, storeId))
}

const problem = (err: unknown): never => {
  if (err instanceof CustomSectionProblem) {
    throw new ThemeLibraryError('THEME_SECTION_INVALID', err.message)
  }
  throw err
}

/** The store's saved sections, newest first. */
export const listCustomSections = (tx: StoreTx, storeId: string) => readList(tx, storeId)

/** Saves a section (a copy of what the merchant selected) to the library. */
export async function saveCustomSection(
  tx: StoreTx,
  storeId: string,
  input: { name: string; block: unknown },
): Promise<CustomSection> {
  try {
    const prepared = prepareCustomSection(input)
    const section: CustomSection = {
      id: globalThis.crypto.randomUUID(),
      ...prepared,
      createdAt: new Date().toISOString(),
    }
    await writeList(tx, storeId, withCustomSection(await readList(tx, storeId), section))
    return section
  } catch (err) {
    return problem(err)
  }
}

/** Renames a saved section. */
export async function renameCustomSection(
  tx: StoreTx,
  storeId: string,
  input: { id: string; name: string },
): Promise<void> {
  const name = input.name.trim()
  if (!name) throw new ThemeLibraryError('THEME_SECTION_INVALID', 'Give the section a name')
  const list = await readList(tx, storeId)
  if (!list.some((s) => s.id === input.id)) {
    throw new ThemeLibraryError('THEME_NOT_FOUND', 'That section is no longer saved')
  }
  await writeList(
    tx,
    storeId,
    list.map((s) => (s.id === input.id ? { ...s, name: name.slice(0, 60) } : s)),
  )
}

/** Removes a saved section; pages that already use a copy keep it. */
export async function deleteCustomSection(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const list = await readList(tx, storeId)
  await writeList(
    tx,
    storeId,
    list.filter((s) => s.id !== id),
  )
}
