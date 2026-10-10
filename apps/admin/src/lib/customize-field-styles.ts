/**
 * One control size for every field in Customize's right panel (Framer and
 * Shopify's editor both run their inspector at 32px controls and 13px text),
 * so a text box, a select and the link picker line up down the panel.
 */
export const FIELD_CONTROL = 'h-8 rounded-lg px-2.5 text-[0.8125rem]'

export const FIELD_TEXTAREA = 'min-h-[4.5rem] rounded-lg px-2.5 py-1.5 text-[0.8125rem] leading-5'

/** A swatch chip (Figma inspector "Colour chips", 369:5147): colour dot plus name, pill shaped. */
export const SWATCH_CHIP =
  'flex h-7 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5 text-xs leading-[1.0625rem] font-medium text-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none'

/** The chosen chip wears the accent ring on its soft wash; the others sit on the card. */
export const swatchChipState = (checked: boolean): string =>
  checked
    ? 'border-[1.5px] border-primary bg-primary-soft'
    : 'border-border bg-card hover:bg-muted/60'
