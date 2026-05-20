// Change this value when client decides the rate
export const POINTS_PER_HOUR = 10

export function calculatePoints(hoursPlayed: number): number {
  return Math.round(hoursPlayed * POINTS_PER_HOUR)
}
