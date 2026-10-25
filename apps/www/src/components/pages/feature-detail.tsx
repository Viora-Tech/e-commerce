import { CheckIcon } from '@commerce/ui/icons'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { featuresContent as copy, type FeatureModule } from '@/data/features'
import WindowFrame from '../common/window-frame'

type FeatureDetailProps = { module: FeatureModule; className?: string }

/** The expanded panel for the selected module: headline, three points, two links and a screen if there is one. */
export default function FeatureDetail({ module, className }: FeatureDetailProps) {
  return (
    <section
      aria-label={module.title}
      className={`surface-card grid items-center gap-8 rounded-3xl p-6 md:p-10 lg:grid-cols-2 ${className ?? ''}`}
    >
      <div className="flex flex-col gap-5">
        <p className="text-eyebrow">{module.title}</p>
        <h2 className="text-3xl font-semibold text-balance text-foreground md:text-subsection">
          {module.headline}
        </h2>
        <ul className="flex flex-col gap-3">
          {module.bullets.map((bullet) => (
            <li key={bullet} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-foreground" />
              {bullet}
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-3">
          <Link href={copy.tourHref} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            {copy.seeInTour}
          </Link>
          <a href={module.guideHref} className={buttonVariants({ variant: 'ghost', size: 'lg' })}>
            {copy.readGuide}
          </a>
        </div>
      </div>
      {module.screen ? (
        <WindowFrame
          url={module.screen.url}
          src={module.screen.src}
          alt={module.screen.alt}
          width={module.screen.width}
          height={module.screen.height}
        />
      ) : null}
    </section>
  )
}
