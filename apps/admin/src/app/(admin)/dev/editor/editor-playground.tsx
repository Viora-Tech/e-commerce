'use client'

import {
  emptyRichText,
  RichTextRenderer,
  type RichTextValue,
  richTextToPlainText,
} from '@commerce/richtext'
import { Card, Layout, Page, Text } from '@shopify/polaris'
import { useState } from 'react'
import { RichTextField } from '@/components/fields/rich-text-field'
import { devEditorContent as copy } from '@/data/dev-editor'
import '@commerce/blocks/styles.css'

/** Local-only media hooks: images become object URLs so the flow can be tried without S3. */
const localMedia = {
  upload: async (file: File) => ({ url: URL.createObjectURL(file), alt: file.name }),
}

export function EditorPlayground() {
  const [value, setValue] = useState<RichTextValue>(emptyRichText)

  return (
    <Page title={copy.title} subtitle={copy.subtitle}>
      <Layout>
        <Layout.Section>
          <Card>
            <RichTextField
              label={copy.fieldLabel}
              helpText={copy.fieldHelp}
              value={value}
              onChange={setValue}
              media={localMedia}
              minHeight={320}
            />
          </Card>
        </Layout.Section>
        <Layout.Section>
          <Card>
            <Text as="h2" variant="headingSm">
              {copy.previewHeading}
            </Text>
            <div className="rich-text-block">
              <RichTextRenderer data={value} className="rte" />
            </div>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h2" variant="headingSm">
              {copy.plainHeading}
            </Text>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{richTextToPlainText(value)}</pre>
          </Card>
        </Layout.Section>
        <Layout.Section variant="oneHalf">
          <Card>
            <Text as="h2" variant="headingSm">
              {copy.jsonHeading}
            </Text>
            <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(value, null, 2)}
            </pre>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  )
}
