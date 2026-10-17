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
        <div className="max-w-[16.25rem] rounded-xl border border-border bg-background px-4 py-3">
          <p className="text-sm font-medium text-foreground">{copy.english.title}</p>
          <p className="text-xs text-muted-foreground">{copy.english.body}</p>
        </div>
        <div className="max-w-[16.25rem] self-end rounded-xl border border-border bg-background px-4 py-3">
          <p lang="hi" className="font-medium text-foreground">
            {copy.hindi.title}
          </p>
          <p lang="hi" className="text-sm text-muted-foreground">
            {copy.hindi.body}
          </p>
        </div>
      </div>
    </BentoTile>
  )
}
