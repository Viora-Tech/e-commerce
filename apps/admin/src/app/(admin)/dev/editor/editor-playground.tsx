'use client'

import {
  emptyRichText,
  RichTextRenderer,
  type RichTextValue,
  richTextToPlainText,
} from '@commerce/richtext'
import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import { useState } from 'react'
import { RichTextField } from '@/components/fields/rich-text-field'
import { PageBody } from '@/components/layout/page-body'
import { PageHeader } from '@/components/layout/page-header'
import { devEditorContent as copy } from '@/data/dev-editor'
import '@/styles/vendor-blocks.css'

/** Local-only media hooks: images become object URLs so the flow can be tried without S3. */
const localMedia = {
  upload: async (file: File) => ({ url: URL.createObjectURL(file), alt: file.name }),
}

export function EditorPlayground() {
  const [value, setValue] = useState<RichTextValue>(emptyRichText)

  return (
    <PageBody>
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <Card size="form">
        <CardContent>
          <RichTextField
            label={copy.fieldLabel}
            helpText={copy.fieldHelp}
            value={value}
            onChange={setValue}
            media={localMedia}
            minHeight={320}
          />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{copy.previewHeading}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rich-text-block">
            <RichTextRenderer data={value} className="rte" />
          </div>
        </CardContent>
      </Card>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{copy.plainHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap text-caption text-foreground">
              {richTextToPlainText(value)}
            </pre>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>{copy.jsonHeading}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto whitespace-pre-wrap font-mono text-[0.6875rem] text-foreground">
              {JSON.stringify(value, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>
    </PageBody>
  )
}
