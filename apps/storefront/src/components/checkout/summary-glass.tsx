/**
 * The summary card's glass, the admin's sales hero recipe: three soft light blobs and a diagonal
 * streak under a thin frost. White light only, so no brand colour tints the card. Decorative, and
 * behind the content: the parent needs `relative isolate overflow-hidden`.
 */
export default function SummaryGlass() {
  // Render logic
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
      <div className="absolute -top-[5.625rem] -left-[3.75rem] h-[16.25rem] w-[26.25rem] rounded-full bg-ck-glass-blob opacity-90 blur-[3.75rem]" />
      <div className="absolute -right-[3.75rem] -bottom-[5rem] h-[13.75rem] w-[22.5rem] rounded-full bg-ck-glass-blob opacity-60 blur-[3.75rem]" />
      <div className="absolute top-[7.5rem] left-[45%] h-[10rem] w-[16.25rem] rounded-full bg-ck-glass-blob opacity-35 blur-[3.75rem]" />
      <div className="absolute -top-[2.5rem] -left-[7.5rem] h-[4.375rem] w-[56.25rem] -rotate-14 bg-ck-glass-streak opacity-90 blur-[2.25rem]" />
      <div className="absolute inset-0 bg-ck-glass-fill" />
    </div>
  )
}
