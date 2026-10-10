import {
  applyMergeTags,
  previewWhatsappBody,
  type WhatsappTemplateRef,
} from '@commerce/core/marketing'
import { Card } from '@commerce/ui/shadcn/card'
import { campaignEditorContent } from '@/data/marketing-campaigns'

type WhatsappPreviewProps = {
  value: WhatsappTemplateRef | null
  /** Body text of the chosen template, when the provider listed it. */
  body: string | null
  storeName: string
}

const copy = campaignEditorContent.whatsapp

/** The broadcast as a chat bubble, with sample values for merge tags. */
export default function WhatsappPreview({ value, body, storeName }: WhatsappPreviewProps) {
  // Render logic
  const merge = { first_name: 'Asha', name: 'Asha Menon', store_name: storeName }
  const filled = value?.variables.map((v) => applyMergeTags(v, merge)) ?? []
  const text = body ? previewWhatsappBody(body, filled) : filled.join(' ')

  return (
    <Card gap="none" inset="none" className="sticky top-4 overflow-hidden">
      <p className="border-b border-border px-4 py-3 text-card-title">{copy.previewTitle}</p>
      <div className="min-h-64 bg-muted p-4">
        {value ? (
          <div className="max-w-[18rem] rounded-lg rounded-tl-none bg-background p-3 shadow-xs">
            <p className="text-caption font-medium text-muted-foreground">{storeName}</p>
            <p className="mt-1 whitespace-pre-line text-body">{text || value.name}</p>
          </div>
        ) : (
          <p className="text-body text-muted-foreground">{copy.pick}</p>
        )}
      </div>
    </Card>
  )
}
