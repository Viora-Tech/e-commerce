import { siteConfig } from '@commerce/config/site'

type RowsPerPage = (typeof siteConfig.ui.rowsPerPage.options)[number]

/** A `?perPage=` value as one of the sizes the footer offers; anything else is the default. */
export function parseRowsPerPage(raw: string | string[] | number | null | undefined): RowsPerPage {
  const value = Number(Array.isArray(raw) ? raw[0] : raw)
  return (
    siteConfig.ui.rowsPerPage.options.find((n) => n === value) ?? siteConfig.ui.rowsPerPage.default
  )
}
