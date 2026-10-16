import Hero from '@/components/park/home/Hero'
import DayStory from '@/components/park/home/DayStory'
import Gallery from '@/components/park/home/Gallery'
import Visit from '@/components/park/home/Visit'
import { parkJsonLd } from '@/lib/park/jsonld'
import type { Metadata } from 'next'

export const metadata: Metadata = { alternates: { canonical: '/' } }

// "A day at MyaThida": the park landing reads as one day, morning to night,
// then a gallery and how to get here (the next morning's light).
export default function ParkHomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // Static data from lib/park/content.ts; `<` escaped so no value can close the tag.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(parkJsonLd()).replace(/</g, '\\u003c') }}
      />
      <Hero />
      <DayStory />
      <Gallery />
      <div
        aria-hidden="true"
        className="park-horizon"
        style={{ ['--from' as string]: 'rgb(var(--park-night))', ['--to' as string]: 'rgb(var(--park-mist))' }}
      />
      <Visit />
    </>
  )
}
