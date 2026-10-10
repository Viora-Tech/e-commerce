/**
 * The inspector's control sizes (Figma "Select" 269:4161 and "Input" 269:4131, 14px text):
 * selects and number boxes 36px with an 8px radius, so a select and the link picker line up
 * down the panel.
 */
export const FIELD_CONTROL = 'h-9 rounded-lg px-3 text-sm'

/** A text box and search: 40px, 10px radius. */
export const FIELD_INPUT = 'h-10 rounded-[0.625rem] px-3 text-sm'

export const FIELD_TEXTAREA = 'min-h-[4.5rem] rounded-[0.625rem] px-3 py-2 text-sm leading-5'

/** A swatch chip (Figma inspector "Colour chips", 369:5147): colour dot plus name, pill shaped. */
export const SWATCH_CHIP =
  'flex h-7 items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1.5 text-xs leading-[1.0625rem] font-medium text-foreground transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none motion-reduce:transition-none'

/** The chosen chip wears the accent ring on its soft wash; the others sit on the card. */
export const swatchChipState = (checked: boolean): string =>
  checked
    ? 'border-[1.5px] border-primary bg-primary-soft'
    : 'border-border bg-card hover:bg-muted/60'
