import { type Db, isStoreSlugTaken } from '@commerce/db'
import { type SlugAvailability, slugFormatProblem } from './slug-format'

export * from './slug-format'

/** Format, reserved words, then a uniqueness check against `store.slug`. */
export async function checkSlugAvailability(db: Db, slug: string): Promise<SlugAvailability> {
  const problem = slugFormatProblem(slug)
  if (problem) return { available: false, problem }
  const taken = await isStoreSlugTaken(db, slug)
  return taken ? { available: false, problem: 'taken' } : { available: true, problem: null }
}
