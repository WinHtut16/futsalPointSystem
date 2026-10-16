import type { TranslationKey } from '@/lib/i18n'

// Every photo slot on the park pages. Drop the client's file at `file` under
// public/ and set `ready: true`; until then ParkPhoto draws a quiet tinted
// block in the slot's tone (and, in development only, the file it expects).
export type PhotoTone = 'pool' | 'sun' | 'jungle' | 'game' | 'billiards' | 'mist'
export type PhotoIcon = 'waves' | 'utensils' | 'ball' | 'gamepad' | 'billiards' | 'trees'

export type Photo = {
  file: string
  ready: boolean
  alt: TranslationKey
  tone: PhotoTone
  icon: PhotoIcon
}

export const PHOTOS = {
  heroPool: { file: '/images/park/hero-pool.jpg', ready: false, alt: 'park.photo.heroPool', tone: 'pool', icon: 'waves' },
  heroFood: { file: '/images/park/hero-food.jpg', ready: false, alt: 'park.photo.heroFood', tone: 'sun', icon: 'utensils' },
  poolKids: { file: '/images/park/pool-kids.jpg', ready: false, alt: 'park.photo.poolKids', tone: 'pool', icon: 'waves' },
  restaurant: { file: '/images/park/restaurant.jpg', ready: false, alt: 'park.photo.restaurant', tone: 'sun', icon: 'utensils' },
  futsal: { file: '/images/court1.jpg', ready: true, alt: 'park.photo.futsal', tone: 'jungle', icon: 'ball' },
  gameRoom: { file: '/images/park/game-room.jpg', ready: false, alt: 'park.photo.gameRoom', tone: 'game', icon: 'gamepad' },
  billiards: { file: '/images/park/billiards.jpg', ready: false, alt: 'park.photo.billiards', tone: 'billiards', icon: 'billiards' },
  entrance: { file: '/images/park/entrance.jpg', ready: false, alt: 'park.photo.entrance', tone: 'mist', icon: 'trees' },
  galleryDeck: { file: '/images/park/gallery-deck.jpg', ready: false, alt: 'park.photo.galleryDeck', tone: 'pool', icon: 'waves' },
  galleryLunch: { file: '/images/park/gallery-lunch.jpg', ready: false, alt: 'park.photo.galleryLunch', tone: 'sun', icon: 'utensils' },
  galleryGarden: { file: '/images/park/gallery-garden.jpg', ready: false, alt: 'park.photo.galleryGarden', tone: 'mist', icon: 'trees' },
  galleryDusk: { file: '/images/park/gallery-dusk.jpg', ready: false, alt: 'park.photo.galleryDusk', tone: 'jungle', icon: 'ball' },
  galleryNight: { file: '/images/park/gallery-night.jpg', ready: false, alt: 'park.photo.galleryNight', tone: 'game', icon: 'gamepad' },
} satisfies Record<string, Photo>

export type PhotoKey = keyof typeof PHOTOS
