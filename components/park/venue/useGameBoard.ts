'use client'

import { useEffect, useState } from 'react'
import { BOARD_POLL_MS, BOARD_STALE_MS, type GameBoard } from '@/lib/park/game-board'

/**
 * The live game board: starts from the server-rendered read and polls
 * /api/park/game-board while the tab is visible (same-origin polling, like
 * hooks/useBookingSlotRefresh.ts; no Realtime socket). Keeps the last good
 * board through a failed poll, and returns null once it is older than
 * BOARD_STALE_MS so the page never shows old states as live.
 */
export function useGameBoard(initial: GameBoard | null): { board: GameBoard | null; now: number } {
  const [board, setBoard] = useState(initial)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    const refresh = async () => {
      if (document.visibilityState !== 'visible') return
      setNow(Date.now())
      try {
        const res = await fetch('/api/park/game-board', { cache: 'no-store' })
        if (!res.ok) return
        const next = (await res.json()) as GameBoard
        if (alive) {
          setBoard(next)
          setNow(Date.now())
        }
      } catch {
        // Offline or flaky network: keep the last board until it goes stale.
      }
    }
    const timer = setInterval(refresh, BOARD_POLL_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const fresh = board && now - Date.parse(board.at) < BOARD_STALE_MS ? board : null
  return { board: fresh, now }
}
