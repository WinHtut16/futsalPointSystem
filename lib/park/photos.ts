import type { TranslationKey } from '@/lib/i18n'

// Every photo slot on the park pages. Files under public/images/park/ are
// produced by scripts/park-photos.py from the client's originals (crop, light
// retouch, faces blurred, EXIF stripped); edit scripts/park-photos.json and
// re-run it rather than editing the JPEGs. A slot with `ready: false` draws a
// quiet tinted block in its tone (and, in development, the file it expects).
export type PhotoTone = 'pool' | 'sun' | 'jungle' | 'game' | 'billiards' | 'mist' | 'night'
export type PhotoIcon = 'waves' | 'utensils' | 'ball' | 'gamepad' | 'billiards' | 'trees' | 'store'

export type Photo = {
  file: string
  ready: boolean
  alt: TranslationKey
  tone: PhotoTone
  icon: PhotoIcon
}

export const PHOTOS = {
  heroPool: { file: '/images/park/hero-pool.jpg', ready: true, alt: 'park.photo.heroPool', tone: 'pool', icon: 'waves' },
  heroMarket: { file: '/images/park/hero-market.jpg', ready: true, alt: 'park.photo.heroMarket', tone: 'night', icon: 'store' },
  poolSwim: { file: '/images/park/pool-swim.jpg', ready: true, alt: 'park.photo.poolSwim', tone: 'pool', icon: 'waves' },
  poolDining: { file: '/images/park/pool-lunch.jpg', ready: true, alt: 'park.photo.poolDining', tone: 'sun', icon: 'utensils' },
  futsal: { file: '/images/park/futsal-court.jpg', ready: true, alt: 'park.photo.futsal', tone: 'jungle', icon: 'ball' },
  gameRoom: { file: '/images/park/games-lounge.jpg', ready: true, alt: 'park.photo.gameRoom', tone: 'game', icon: 'gamepad' },
  gameVip: { file: '/images/park/games-vip.jpg', ready: true, alt: 'park.photo.gameVip', tone: 'game', icon: 'gamepad' },
  gameControllers: { file: '/images/park/games-controllers.jpg', ready: true, alt: 'park.photo.gameControllers', tone: 'game', icon: 'gamepad' },
  poolLength: { file: '/images/park/pool-hero.jpg', ready: true, alt: 'park.photo.poolLength', tone: 'pool', icon: 'waves' },
  poolShallow: { file: '/images/park/pool-shallow.jpg', ready: true, alt: 'park.photo.poolShallow', tone: 'pool', icon: 'waves' },
  poolFood: { file: '/images/park/pool-food.jpg', ready: true, alt: 'park.photo.poolFood', tone: 'sun', icon: 'utensils' },
  marketLane: { file: '/images/park/market-lane.jpg', ready: true, alt: 'park.photo.marketLane', tone: 'night', icon: 'store' },
  entrance: { file: '/images/park/visit-entrance.jpg', ready: true, alt: 'park.photo.entrance', tone: 'mist', icon: 'trees' },
  galleryFutsal: { file: '/images/park/gallery-futsal.jpg', ready: true, alt: 'park.photo.galleryFutsal', tone: 'jungle', icon: 'ball' },
  galleryPath: { file: '/images/park/gallery-path.jpg', ready: true, alt: 'park.photo.galleryPath', tone: 'mist', icon: 'trees' },
  galleryPlaza: { file: '/images/park/gallery-plaza.jpg', ready: true, alt: 'park.photo.galleryPlaza', tone: 'mist', icon: 'trees' },
  galleryMarket: { file: '/images/park/gallery-market.jpg', ready: true, alt: 'park.photo.galleryMarket', tone: 'night', icon: 'store' },
  galleryPoolWater: { file: '/images/park/gallery-pool-water.jpg', ready: true, alt: 'park.photo.galleryPoolWater', tone: 'pool', icon: 'waves' },
  galleryPoolLadder: { file: '/images/park/gallery-pool-ladder.jpg', ready: true, alt: 'park.photo.galleryPoolLadder', tone: 'pool', icon: 'waves' },
  galleryGreens: { file: '/images/park/gallery-greens.jpg', ready: true, alt: 'park.photo.galleryGreens', tone: 'jungle', icon: 'trees' },
  galleryEveningWalk: { file: '/images/park/gallery-evening-walk.jpg', ready: true, alt: 'park.photo.galleryEveningWalk', tone: 'mist', icon: 'trees' },
  gallerySunsetStatue: { file: '/images/park/gallery-sunset-statue.jpg', ready: true, alt: 'park.photo.gallerySunsetStatue', tone: 'sun', icon: 'trees' },
  galleryFutsalNight: { file: '/images/park/gallery-futsal-night.jpg', ready: true, alt: 'park.photo.galleryFutsalNight', tone: 'jungle', icon: 'ball' },
  galleryLaneBlueHour: { file: '/images/park/gallery-lane-bluehour.jpg', ready: true, alt: 'park.photo.galleryLaneBlueHour', tone: 'night', icon: 'store' },
} satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS
