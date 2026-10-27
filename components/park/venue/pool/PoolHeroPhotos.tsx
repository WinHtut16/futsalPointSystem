'use client'

import LivePhoto from '../../LivePhoto'

// Hero collage: the whole pool end to end, with the shallow end (an adult
// and children seen through leaves) as a smaller print tucked over its
// lower-left corner. Both are LivePhotos: reveal, slow drift, pointer tilt.
export default function PoolHeroPhotos() {
  return (
    <div className="relative pb-14 pl-0 sm:pb-16 sm:pl-10">
      <LivePhoto
        photo="poolLength"
        light="water"
        priority
        sizes="(min-width: 1024px) 560px, 92vw"
        className="aspect-[5/4] rounded-[28px] shadow-[0_30px_80px_rgb(26_29_31/0.18)]"
      />
      <LivePhoto
        photo="poolShallow"
        light="water"
        sizes="(min-width: 1024px) 260px, 46vw"
        wrapClass="pool-print absolute bottom-0 left-3 w-[48%] sm:left-0 sm:w-[44%]"
        className="aspect-[4/3] rounded-[18px] ring-[5px] ring-white shadow-[0_18px_40px_rgb(26_29_31/0.28)]"
      />
    </div>
  )
}
