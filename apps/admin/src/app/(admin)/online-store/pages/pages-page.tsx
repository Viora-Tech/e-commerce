'use client'

import { Badge, Modal, Page, Text, TextField } from '@shopify/polaris'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ResourceTable, type ResourceTableColumn } from '@/components/polaris/resource-table'
import { api } from '@/lib/api-client'

type Item = Awaited<ReturnType<typeof api.pages.list>>[number]

const columns: ResourceTableColumn<Item>[] = [
  {
    id: 'title',
    title: 'Title',
    render: (p) => (
      <Text as="span" fontWeight="semibold">
        {p.title}
      </Text>
    ),
  },
  {
    id: 'handle',
    title: 'URL',
    render: (p) => <Text as="span">/{p.handle === 'home' ? '' : `pages/${p.handle}`}</Text>,
  },
  {
    id: 'status',
    title: 'Status',
    render: (p) =>
      p.publishedAt ? <Badge tone="success">Published</Badge> : <Badge tone="info">Draft</Badge>,
  },
  {
    id: 'updated',
    title: 'Updated',
    render: (p) => <Text as="span">{new Date(p.updatedAt).toLocaleString('en-IN')}</Text>,
  },
]

export function PagesPage() {
  const router = useRouter()
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [title, setTitle] = useState('')
  const [handle, setHandle] = useState('')

  useEffect(() => {
    api.pages
      .list()
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  async function create() {
    const p = await api.pages.create({
      title,
      handle:
        handle ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, ''),
      data: { root: { props: { title } }, content: [], zones: {} },
    })
    if (p) router.push(`/online-store/pages/${p.id}`)
  }

  const shown = items.filter((p) => !query || p.title.toLowerCase().includes(query.toLowerCase()))

  return (
    <Page title="Pages" primaryAction={{ content: 'Add page', onAction: () => setCreating(true) }}>
      <ResourceTable
        resourceName={{ singular: 'page', plural: 'pages' }}
        columns={columns}
        items={shown}
        getId={(p) => p.id}
        onRowClick={(p) => router.push(`/online-store/pages/${p.id}`)}
        loading={loading}
        query={query}
        onQueryChange={setQuery}
        page={1}
        perPage={100}
        total={shown.length}
        onPageChange={() => {}}
        selectable={false}
        empty={{ heading: 'No pages yet', body: 'Add a page to start building with the editor.' }}
      />
      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="Add page"
        primaryAction={{ content: 'Create', onAction: create, disabled: !title }}
      >
        <Modal.Section>
          <TextField label="Title" value={title} onChange={setTitle} autoComplete="off" />
          <TextField
            label="URL handle"
            prefix="/pages/"
            value={handle}
            onChange={setHandle}
            autoComplete="off"
            helpText="Leave blank to derive from the title. Use 'home' for the home page."
          />
        </Modal.Section>
      </Modal>
    </Page>
  )
}
