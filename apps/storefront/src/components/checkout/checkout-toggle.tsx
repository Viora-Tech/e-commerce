import SwitchTrack from './switch-track'

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
      <SwitchTrack />
    </label>
  )
}
