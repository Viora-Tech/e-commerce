import 'server-only'
import { cookies, headers } from 'next/headers'
import { flightOnlyRequest } from './flight-request'
import { needsNotFoundMarkup } from './not-found-rule'
import { rendersImportedTheme } from './template-render'
import { isRerender, RERENDER_COOKIE } from './themed-rerender'

/** `needsNotFoundMarkup` for this request. */
export async function notFoundMarkupNeeded(storeId: string): Promise<boolean> {
  const pathname = (await headers()).get('x-pathname') ?? '/'
  return needsNotFoundMarkup({
    imported: await rendersImportedTheme(storeId),
    flightOnly: await flightOnlyRequest(),
    rerender: isRerender((await cookies()).get(RERENDER_COOKIE)?.value, pathname),
  })
}
