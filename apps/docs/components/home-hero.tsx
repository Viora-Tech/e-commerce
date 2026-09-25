import { Search } from 'nextra/components'
import { heroContent } from '../data/home'
import LogoMark from './logo-mark'

export default function HomeHero() {
  return (
    <section
      className="not-prose flex flex-col items-center gap-5 border-b px-6 py-14 text-center sm:py-16"
      style={{ borderColor: 'var(--surface-border)' }}
    >
      <LogoMark size={36} />
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heroContent.title}</h1>
      <p className="max-w-xl text-base opacity-70 sm:text-lg">{heroContent.pitch}</p>
      <div className="w-full max-w-md">
        <Search
          placeholder={heroContent.searchPlaceholder}
          className="[&_input]:rounded-lg [&_input]:border [&_input]:px-4 [&_input]:py-2.5 [&_input]:text-sm"
        />
      </div>
    </section>
  )
}
