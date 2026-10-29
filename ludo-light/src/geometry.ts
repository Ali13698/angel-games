import { colorIndex } from './model.ts'
import type { LudoState } from './model.ts'

export type Point = [number, number]

export const palette = [
  '#41d6ae',
  '#f5c65b',
  '#65b8ff',
  '#f08394'
]

export const names = ['سبز', 'طلایی', 'آبی', 'مرجانی']

export const track: Point[] = [
  [6, 13], [6, 12], [6, 11], [6, 10], [6, 9],
  [5, 8], [4, 8], [3, 8], [2, 8], [1, 8],
  [0, 8], [0, 7], [0, 6],

  [1, 6], [2, 6], [3, 6], [4, 6], [5, 6],
  [6, 5], [6, 4], [6, 3], [6, 2], [6, 1],
  [6, 0], [7, 0], [8, 0],

  [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
  [9, 6], [10, 6], [11, 6], [12, 6], [13, 6],
  [14, 6], [14, 7], [14, 8],

  [13, 8], [12, 8], [11, 8], [10, 8], [9, 8],
  [8, 9], [8, 10], [8, 11], [8, 12], [8, 13],
  [8, 14], [7, 14], [6, 14]
]

export const yards: Point[] = [
  [0, 9],
  [0, 0],
  [9, 0],
  [9, 9]
]

export function lane(color: number, step: number): Point {
  const distance = 13 - step

  if (color === 0) return [7, distance]
  if (color === 1) return [14 - distance, 7]
  if (color === 2) return [7, 14 - distance]

  return [distance, 7]
}

export function tokenPoint(
  s: LudoState,
  seat: number,
  token: number
): Point {
  const color = colorIndex(s.seats.length, seat)
  const pos = s.board[seat * 4 + token]

  if (pos === -1) {
    const [x, y] = yards[color]
    return [
      x + 1.7 + (token % 2) * 2.6,
      y + 1.7 + Math.floor(token / 2) * 2.6
    ]
  }

  if (pos === 56) return [7, 7]
  if (pos > 50) return lane(color, pos - 51)

  return track[(color * 13 + pos) % 52]
}
