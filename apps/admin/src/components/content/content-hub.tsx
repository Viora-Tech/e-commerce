'use client'

import { Blocks, Images, Newspaper, Workflow } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import type { ReactNode } from 'react'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import { contentContent } from '@/data/content'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

/** Facts for each card; `null` when the member may not read it or the lookup failed. */
export type ContentHubFacts = {
  files: { total: number } | null
  contentTypes: { names: string[] } | null
  menus: { names: string[] } | null
  blogPosts: { posts: number; drafts: number } | null
}

type HubCardProps = {
  icon: ReactNode
  title: string
  facts: string | null
  body: string
  open: string
  href: string
}

const NAMES_SHOWN = 3

function HubCard({ icon, title, facts, body, open, href }: HubCardProps) {
  // Render logic
  return (
    <div className="flex min-w-0 flex-col items-start gap-3.5 rounded-2xl border surface-card px-5.5 py-5">
      <div className="flex w-full items-center gap-3.5">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary [&_svg]:size-5.5">
          {icon}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="truncate text-[1rem] leading-6 font-semibold text-ink-strong">{title}</h2>
          {facts ? <p className="truncate text-caption text-muted-foreground">{facts}</p> : null}
        </div>
      </div>
      <p className="text-body text-muted-foreground">{body}</p>
      <Button variant="outline" nativeButton={false} render={<Link href={href} />}>
        {open}
      </Button>
    </div>
  )
}

const namesLine = (names: string[]) =>
  names.length > NAMES_SHOWN ? `${names.slice(0, NAMES_SHOWN).join(', ')}…` : names.join(', ')

/** Content hub: four cards (Files, Content types, Menus, Blog posts) with a plain-words count each. */
export default function ContentHub({ facts }: { facts: ContentHubFacts }) {
  // Hooks
  const copy = useCopy(contentContent)

  // Render logic
  const cards = copy.cards
  const filesFacts = facts.files
    ? facts.files.total > 0
      ? cards.files.count(facts.files.total)
      : cards.files.none
    : null
  const typesFacts = facts.contentTypes
    ? facts.contentTypes.names.length > 0
      ? cards.contentTypes.count(
          facts.contentTypes.names.length,
          namesLine(facts.contentTypes.names),
        )
      : cards.contentTypes.none
    : null
  const menusFacts = facts.menus
    ? facts.menus.names.length > 0
      ? cards.menus.count(facts.menus.names.length, namesLine(facts.menus.names))
      : cards.menus.none
    : null
  const blogFacts = facts.blogPosts
    ? facts.blogPosts.posts > 0
      ? cards.blogPosts.count(facts.blogPosts.posts, facts.blogPosts.drafts)
      : cards.blogPosts.none
    : null

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary}
      actions={
        <Button nativeButton={false} render={<Link href={routes.onlineStore.pages()} />}>
          {copy.goToPages}
        </Button>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <HubCard
          icon={<Images aria-hidden />}
          title={cards.files.title}
          facts={filesFacts}
          body={cards.files.body}
          open={cards.files.open}
          href={routes.content.files()}
        />
        <HubCard
          icon={<Blocks aria-hidden />}
          title={cards.contentTypes.title}
          facts={typesFacts}
          body={cards.contentTypes.body}
          open={cards.contentTypes.open}
          href={routes.content.contentTypes()}
        />
        <HubCard
          icon={<Workflow aria-hidden />}
          title={cards.menus.title}
          facts={menusFacts}
          body={cards.menus.body}
          open={cards.menus.open}
          href={routes.content.menus()}
        />
        <HubCard
          icon={<Newspaper aria-hidden />}
          title={cards.blogPosts.title}
          facts={blogFacts}
          body={cards.blogPosts.body}
          open={cards.blogPosts.open}
          href={routes.content.blogPosts()}
        />
      </div>
    </ProoflyListPage>
  )
}
