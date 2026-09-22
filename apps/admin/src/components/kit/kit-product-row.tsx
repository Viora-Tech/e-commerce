import { type IconComponent, Plus } from '@commerce/ui/icons'
import KitButton from './kit-button'
import KitThumb from './kit-thumb'

type KitProductRowProps = {
  image: string | null
  title: string
  /** 14/700 Ocean Green price under the name. */
  price: string
  action: { label: string; href: string; icon?: IconComponent }
}

/** Sheet 14:938 product row: 46px thumb, name 14/400, price 14/700 green, "Add" pill on the right; rows split by a hairline. */
export default function KitProductRow({ image, title, price, action }: KitProductRowProps) {
  // Render logic
  const ActionIcon = action.icon ?? Plus

  return (
    <div className="flex items-center gap-3 border-line-list border-b pb-3 last:border-b-0 last:pb-0">
      <KitThumb src={image} alt="" size="category" />
      <span className="flex min-w-0 flex-1 flex-col gap-1.5">
        <span className="truncate text-kit-body text-foreground">{title}</span>
        <span className="text-kit-body font-bold text-primary tabular-nums">{price}</span>
      </span>
      <KitButton variant="add" href={action.href}>
        <ActionIcon aria-hidden="true" />
        {action.label}
      </KitButton>
    </div>
  )
}
