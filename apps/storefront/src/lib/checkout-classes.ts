/*
 * Class lists the locked checkout's pieces share, so a field, a select and a textarea
 * cannot drift apart. Colours are the --ck-* tokens from globals.css.
 *
 * The `!` marks are deliberate: the storefront also loads the theme's unlayered base
 * stylesheet (packages/blocks/src/styles/base.css: `h1..h6` sizes and uppercase, `button`
 * without background or border, `* { margin: 0 }`, `img { height: auto }`), and unlayered
 * rules beat Tailwind's layered utilities. Importance is how the checkout stays its own
 * look whatever theme is live.
 */

/** Headings inside the checkout: one typeface, sentence case, never the theme's scale. */
export const CK_HEADING = 'font-ck! normal-case! tracking-[-0.011em]! font-semibold! leading-snug!'

/** A card of the one-page checkout: white on the canvas, a hairline ring and a soft lift. */
export const CK_CARD =
  'rounded-[calc(var(--ck-radius)*1.2)] bg-ck-bg [box-shadow:var(--ck-section-shadow)]'

/** A picked radio card (shipping option, way to pay): the accent ring, a soft fill. */
export const CK_PICKED = 'border-ck-accent bg-ck-canvas [box-shadow:0_0_0_1px_var(--ck-accent)]'

/** A radio card not picked. */
export const CK_UNPICKED = 'border-ck-line bg-ck-bg hover:border-ck-muted/50'

/** Labels above inputs. */
export const CK_LABEL = 'text-[0.75rem] font-medium text-ck-ink/80 sm:text-[0.8125rem]'

/** The box every input, select and textarea draws. */
export const CK_INPUT =
  'block w-full rounded-ck border border-ck-line bg-ck-field px-3.5 text-[1rem]! text-ck-ink! [box-shadow:0_1px_1px_rgb(0_0_0/0.03)] outline-none transition-[border-color,box-shadow] duration-150 placeholder:text-ck-muted/70 hover:border-ck-muted/50 focus:border-ck-accent focus:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:opacity-60 motion-reduce:transition-none aria-invalid:border-ck-danger aria-invalid:focus:[box-shadow:0_0_0_3px_var(--ck-danger-ring)] [&:is(input):read-only]:bg-ck-soft [&:is(input):read-only]:text-ck-muted!'

/**
 * A field the checkout filled in for the shopper (City and State from the PIN code): the soft
 * grey of the design, and a brief wash of the accent that fades out as it lands (600ms
 * ease-out, `ck-filled` in globals.css; a colour change only, so it stays with reduced motion).
 */
export const CK_INPUT_FILLED = `${CK_INPUT.replace('bg-ck-field', 'bg-ck-soft')} animate-[ck-filled_600ms_var(--ease-out)]`

/** Single-line inputs and selects share one height, comfortable to tap. */
export const CK_INPUT_HEIGHT = 'h-11'

/**
 * The main call to action: Pay, Retry payment, Get a new QR. Pressed it settles to
 * `--motion-press-scale` (0.97, 1 under reduced motion) in 140ms ease-out.
 */
export const CK_BUTTON_PRIMARY =
  'inline-flex h-13 w-full items-center justify-center gap-2 rounded-ck-button! bg-ck-button! px-5 text-[0.9375rem]! font-bold! text-ck-button-ink! [box-shadow:0_1px_2px_rgb(0_0_0/0.08),inset_0_1px_0_rgb(255_255_255/0.08)] outline-none touch-manipulation transition-[filter,scale,box-shadow] duration-(--duration-press) ease-out hover:brightness-[1.08] active:scale-(--motion-press-scale) focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-55 disabled:hover:brightness-100 disabled:active:scale-100'

/** Quieter actions: Continue shopping, Download invoice, Other UPI app. */
export const CK_BUTTON_SECONDARY =
  'inline-flex h-11 items-center justify-center gap-2 rounded-ck-button! border! border-ck-line! bg-ck-field! px-4 text-[0.9375rem]! font-medium! text-ck-ink! no-underline outline-none transition-colors duration-150 hover:bg-ck-soft! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none'

/** Inline text actions: Add discount code, Sign in, Remove. */
export const CK_LINK =
  'cursor-pointer rounded-sm bg-transparent! p-0! text-[0.875rem]! font-medium! text-ck-accent! underline-offset-4 outline-none hover:underline focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)]'
