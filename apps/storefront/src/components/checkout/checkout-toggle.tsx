type CheckoutToggleProps = {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/** One switch row: a native checkbox, so the keyboard and screen readers work as usual. */
export default function CheckoutToggle({ label, checked, onChange }: CheckoutToggleProps) {
  // Render logic
  return (
    <label className="flex min-h-13 cursor-pointer items-center justify-between gap-4 px-4 py-3 text-[0.875rem] text-ck-ink">
      {label}
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden="true"
        className="flex h-6 w-10 shrink-0 items-center rounded-full bg-ck-soft p-0.5 inset-ring inset-ring-ck-line-strong transition-colors duration-150 ease-out peer-checked:bg-ck-button peer-checked:inset-ring-transparent peer-focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] peer-checked:[&>span]:translate-x-4 peer-checked:[&>span]:bg-ck-button-ink motion-reduce:transition-none"
      >
        <span className="size-5 rounded-full bg-ck-muted transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none" />
      </span>
    </label>
  )
}
