type RadioDotProps = { checked: boolean }

/**
 * The round mark on a radio card (design: a white centre in a thick accent ring). Picking
 * fills the ring with the accent and grows the centre in (150ms ease-out, opacity and scale);
 * reduced motion keeps the colour change and drops the scale.
 */
export default function RadioDot({ checked }: RadioDotProps) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-4 shrink-0 place-items-center rounded-full border-[1.5px] transition-[background-color,border-color] duration-150 ease-out motion-reduce:transition-none ${checked ? 'border-ck-accent bg-ck-accent' : 'border-ck-muted/45 bg-ck-bg'}`}
    >
      <span
        className={`size-1.5 rounded-full bg-ck-bg transition-[opacity,scale] duration-150 ease-out motion-reduce:scale-100 ${checked ? 'scale-100 opacity-100' : 'scale-50 opacity-0'}`}
      />
    </span>
  )
}
