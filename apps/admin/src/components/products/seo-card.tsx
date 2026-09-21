'use client'

import { type RichTextValue, richTextToPlainText } from '@commerce/richtext'
import {
  BlockStack,
  Button,
  Card,
  FormLayout,
  InlineStack,
  Text,
  TextField,
} from '@shopify/polaris'
import { useState } from 'react'
import { productFormContent } from '@/data/products'

type SeoCardProps = {
  title: string
  description: RichTextValue | null
  seoTitle: string
  seoDescription: string
  handle: string
  storefrontOrigin: string
  onSeoTitle: (value: string) => void
  onSeoDescription: (value: string) => void
  onHandle: (value: string) => void
}

const copy = productFormContent.seo

export function SeoCard({
  title,
  description,
  seoTitle,
  seoDescription,
  handle,
  storefrontOrigin,
  onSeoTitle,
  onSeoDescription,
  onHandle,
}: SeoCardProps) {
  const [editing, setEditing] = useState(Boolean(seoTitle || seoDescription))

  const previewTitle = seoTitle || title
  const previewDescription = (seoDescription || richTextToPlainText(description)).slice(0, 160)
  const url = `${storefrontOrigin}${copy.handlePrefix}${handle}`

  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center">
          <Text as="h2" variant="headingSm">
            {copy.heading}
          </Text>
          {!editing ? (
            <Button variant="plain" onClick={() => setEditing(true)}>
              {copy.edit}
            </Button>
          ) : null}
        </InlineStack>
        {previewTitle ? (
          <BlockStack gap="050">
            <Text as="p" variant="bodySm" tone="subdued">
              {url}
            </Text>
            <Text as="p" variant="headingMd" tone="magic">
              {previewTitle}
            </Text>
            <Text as="p" variant="bodySm">
              {previewDescription}
            </Text>
          </BlockStack>
        ) : (
          <Text as="p" tone="subdued" variant="bodySm">
            {copy.previewHint}
          </Text>
        )}
        {editing ? (
          <FormLayout>
            <TextField
              label={copy.title}
              value={seoTitle}
              onChange={onSeoTitle}
              placeholder={title}
              maxLength={70}
              helpText={copy.titleHelp(seoTitle.length)}
              autoComplete="off"
            />
            <TextField
              label={copy.description}
              value={seoDescription}
              onChange={onSeoDescription}
              multiline={3}
              maxLength={320}
              helpText={copy.descriptionHelp(seoDescription.length)}
              autoComplete="off"
            />
            <TextField
              label={copy.handle}
              prefix={copy.handlePrefix}
              value={handle}
              onChange={onHandle}
              autoComplete="off"
            />
          </FormLayout>
        ) : null}
      </BlockStack>
    </Card>
  )
}
