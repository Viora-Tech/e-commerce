'use client'

import { Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { Field, FieldGroup, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useState } from 'react'
import TagInput from '@/components/fields/tag-input'
import { articleFormContent } from '@/data/blog'
import { useCopy } from '@/hooks/use-copy'
import BlogDialog from './blog-dialog'
import type { BlogOption } from './form-state'

type ArticleOrganisationCardProps = {
  blogs: BlogOption[]
  blogId: string
  author: string
  tags: string[]
  tagSuggestions: string[]
  onChange: (patch: { blogId?: string; author?: string; tags?: string[] }) => void
  onBlogCreated: (blog: { id: string; title: string }) => void
}

/** Which blog the post lives in, who wrote it, and its tags. */
export default function ArticleOrganisationCard({
  blogs,
  blogId,
  author,
  tags,
  tagSuggestions,
  onChange,
  onBlogCreated,
}: ArticleOrganisationCardProps) {
  // Hooks
  const { organisation: copy } = useCopy(articleFormContent)
  const [creating, setCreating] = useState(false)

  // Event handlers
  const handleCreated = (blog: { id: string; title: string }) => {
    onBlogCreated(blog)
    onChange({ blogId: blog.id })
  }

  // Render logic
  const items = Object.fromEntries(blogs.map((b) => [b.id, b.title]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="article-blog">{copy.blog}</FieldLabel>
            <Select
              items={items}
              value={blogId}
              onValueChange={(v) => onChange({ blogId: String(v) })}
            >
              <SelectTrigger id="article-blog" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {blogs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="self-start"
              onClick={() => setCreating(true)}
            >
              <Plus />
              {copy.createBlog}
            </Button>
          </Field>
          <Field>
            <FieldLabel htmlFor="article-author">{copy.author}</FieldLabel>
            <Input
              id="article-author"
              size="lg"
              value={author}
              maxLength={120}
              onChange={(e) => onChange({ author: e.target.value })}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="article-tags">{copy.tags}</FieldLabel>
            <TagInput
              id="article-tags"
              tags={tags}
              suggestions={tagSuggestions}
              placeholder={copy.tagsPlaceholder}
              onChange={(next) => onChange({ tags: next })}
            />
          </Field>
        </FieldGroup>
      </CardContent>
      <BlogDialog open={creating} blog={null} onOpenChange={setCreating} onSaved={handleCreated} />
    </Card>
  )
}
