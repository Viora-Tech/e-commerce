import { homeContent } from '@/data/home'
import BentoTile from './bento-tile'

const copy = homeContent.india.hindi

export default function HindiTile() {
  return (
    <BentoTile
      eyebrow={copy.eyebrow}
      title={copy.title}
      body={copy.body}
      className="min-h-[18.75rem]"
    >
      <div className="flex flex-col gap-3">
        <p
          aria-hidden
          className="glass-panel flex w-fit rounded-full p-0.5 text-xs font-medium text-muted-foreground"
        >
          <span className="rounded-full bg-foreground px-2.5 py-0.5 text-background transition-colors duration-300 group-hover:bg-transparent group-hover:text-muted-foreground">
            {copy.toggle[0]}
          </span>
          <span className="rounded-full px-2.5 py-0.5 transition-colors duration-300 group-hover:bg-foreground group-hover:text-background">
            {copy.toggle[1]}
          </span>
        </p>
        <div className="relative max-w-[16.25rem] rounded-xl border border-border bg-background px-4 py-3">
          <div className="transition-[opacity,translate] duration-500 ease-(--ease-out) group-hover:-translate-y-1 group-hover:opacity-0">
            <p className="text-sm font-medium text-foreground">{copy.english.title}</p>
            <p className="text-xs text-muted-foreground">{copy.english.body}</p>
          </div>
          <div
            lang="hi"
            aria-hidden
            className="absolute inset-0 translate-y-1 px-4 py-3 opacity-0 transition-[opacity,translate] duration-500 ease-(--ease-out) group-hover:translate-y-0 group-hover:opacity-100"
          >
            <p className="text-sm font-medium text-foreground">{copy.hindi.title}</p>
            <p className="text-xs text-muted-foreground">{copy.hindi.body}</p>
          </div>
        </div>
        <div className="relative max-w-[16.25rem] self-end rounded-xl border border-border bg-background px-4 py-3">
          <div
            lang="hi"
            className="transition-[opacity,translate] duration-500 ease-(--ease-out) group-hover:-translate-y-1 group-hover:opacity-0"
          >
            <p className="font-medium text-foreground">{copy.hindi.title}</p>
            <p className="text-sm text-muted-foreground">{copy.hindi.body}</p>
          </div>
          <div
            aria-hidden
            className="absolute inset-0 translate-y-1 px-4 py-3 opacity-0 transition-[opacity,translate] duration-500 ease-(--ease-out) group-hover:translate-y-0 group-hover:opacity-100"
          >
            <p className="text-sm font-medium text-foreground">{copy.english.title}</p>
            <p className="text-xs text-muted-foreground">{copy.english.body}</p>
          </div>
        </div>
      </div>
    </BentoTile>
  )
}
