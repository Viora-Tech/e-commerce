/**
 * The checkout's switch drawing: a track with a knob, after a `peer sr-only` checkbox with
 * `role="switch"` that does the work (checked colours and focus ring come from `peer-*`). One
 * drawing for every checkout switch (owner, 22 Nov 2026: reuse, not copies).
 */
export default function SwitchTrack() {
  // Render logic
  return (
    <span
      aria-hidden="true"
      className="flex h-6 w-10 shrink-0 items-center rounded-full bg-ck-soft p-0.5 inset-ring inset-ring-ck-line-strong transition-colors duration-150 ease-out peer-checked:bg-ck-button peer-checked:inset-ring-transparent peer-focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] peer-checked:[&>span]:translate-x-4 peer-checked:[&>span]:bg-ck-button-ink motion-reduce:transition-none"
    >
      <span className="size-5 rounded-full bg-ck-muted transition-[translate,background-color] duration-150 ease-out motion-reduce:transition-none" />
    </span>
  )
}
