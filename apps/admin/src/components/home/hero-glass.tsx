/**
 * The sales hero's glass (Figma "Glass layers" in 583:1865): three soft light blobs and a
 * diagonal specular streak under a translucent frost. Purely decorative and behind the content;
 * the parent needs `relative isolate overflow-hidden`. Blobs keep their Figma sizes (420x260,
 * 360x220, 260x160) rather than scaling with the card, so a short card (no sales yet) still
 * glows. No backdrop blur on the frost: Chrome stops clipping it to the rounded corners, and
 * the blobs are already blurred.
 */
export default function HeroGlass() {
  // Render logic
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-[5.625rem] -left-[3.75rem] h-[16.25rem] w-[26.25rem] rounded-full bg-glass-blob opacity-90 blur-[3.75rem]" />
      <div className="absolute -right-[3.75rem] -bottom-[5rem] h-[13.75rem] w-[22.5rem] rounded-full bg-glass-blob opacity-60 blur-[3.75rem]" />
      <div className="absolute top-[7.5rem] left-[45%] h-[10rem] w-[16.25rem] rounded-full bg-glass-blob opacity-35 blur-[3.75rem]" />
      <div className="absolute -top-[2.5rem] -left-[7.5rem] h-[4.375rem] w-[56.25rem] -rotate-14 bg-glass-streak/40 opacity-90 blur-[2.25rem]" />
      <div className="absolute inset-0 bg-glass-fill/30" />
    </div>
  )
}
