// Every Rive animation slot on the park pages. Build each file to the spec in
// docs/park/rive-specs.md, drop it in public/rive/, then set `ready: true`.
// Until then (and always for reduced-motion visitors) the slot shows its
// code-drawn fallback, so nothing is fetched for a file that does not exist.
//
// Contract with the .riv files: one artboard per entry, a state machine
// named "Main", and the artboard's default view model holding the properties
// the page writes (data binding, autoBind on).

export type RiveAnim = {
  file: string
  artboard: string
  ready: boolean
}

export const RIVE = {
  sunArc: { file: '/rive/sun-arc.riv', artboard: 'SunArc', ready: false },
  iconPool: { file: '/rive/venue-icons.riv', artboard: 'Pool', ready: false },
  iconFood: { file: '/rive/venue-icons.riv', artboard: 'Food', ready: false },
  iconFutsal: { file: '/rive/venue-icons.riv', artboard: 'Futsal', ready: false },
  iconGames: { file: '/rive/venue-icons.riv', artboard: 'Games', ready: false },
  iconBilliards: { file: '/rive/venue-icons.riv', artboard: 'Billiards', ready: false },
} satisfies Record<string, RiveAnim>

export type RiveKey = keyof typeof RIVE

export const RIVE_STATE_MACHINE = 'Main'
