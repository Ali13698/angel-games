import { colorIndex } from './model.ts'
import type { LudoState } from './model.ts'
import {
  lane,
  names,
  palette,
  tokenPoint,
  track,
  yards
} from './geometry.ts'

const ns = 'http://www.w3.org/2000/svg'

function svg(
  tag: string,
  attributes: Record<string, string | number>
) {
  const node = document.createElementNS(ns, tag)

  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value))
  }

  return node
}

export class Board {
  private tokens: HTMLButtonElement[] = []
  private container: HTMLElement

  constructor(
    container: HTMLElement,
    select: (seat: number, token: number) => void
  ) {
    this.container = container

    const drawing = svg('svg', {
      viewBox: '-0.6 -0.6 16.2 16.2',
      'aria-hidden': 'true'
    })

    drawing.append(svg('rect', {
      x: -0.5,
      y: -0.5,
      width: 16,
      height: 16,
      rx: 0.8,
      fill: '#111f30'
    }))

    yards.forEach(([x, y], color) => {
      drawing.append(svg('rect', {
        x: x + 0.25,
        y: y + 0.25,
        width: 5.5,
        height: 5.5,
        rx: 0.85,
        fill: palette[color],
        'fill-opacity': 0.12,
        stroke: palette[color],
        'stroke-opacity': 0.4,
        'stroke-width': 0.06
      }))

      for (let token = 0; token < 4; token++) {
        drawing.append(svg('circle', {
          cx: x + 2.2 + (token % 2) * 2.6,
          cy: y + 2.2 + Math.floor(token / 2) * 2.6,
          r: 0.65,
          fill: '#101d2c',
          stroke: palette[color],
          'stroke-opacity': 0.18,
          'stroke-width': 0.05
        }))
      }
    })

    track.forEach(([x, y], index) => {
      const safe = index % 13 === 0 || index % 13 === 8

      drawing.append(svg('rect', {
        x: x + 0.055,
        y: y + 0.055,
        width: 0.89,
        height: 0.89,
        rx: 0.18,
        fill: index % 13 === 0
          ? palette[Math.floor(index / 13)]
          : '#25384c'
      }))

      if (safe) {
        const star = svg('text', {
          x: x + 0.5,
          y: y + 0.69,
          'text-anchor': 'middle',
          'font-size': 0.62,
          fill: '#e4efff'
        })

        star.textContent = '✦'
        drawing.append(star)
      }
    })

    for (let color = 0; color < 4; color++) {
      for (let step = 0; step < 5; step++) {
        const [x, y] = lane(color, step)

        drawing.append(svg('rect', {
          x: x + 0.055,
          y: y + 0.055,
          width: 0.89,
          height: 0.89,
          rx: 0.18,
          fill: palette[color],
          'fill-opacity': 0.55 + step * 0.08
        }))
      }
    }

    const center = svg('text', {
      x: 7.5,
      y: 8,
      'text-anchor': 'middle',
      'font-size': 1.5,
      fill: '#f5c65b'
    })

    center.textContent = '✦'
    drawing.append(center)
    container.append(drawing)

    for (let index = 0; index < 16; index++) {
      const button = document.createElement('button')
      button.className = 'token'
      button.textContent = String(index % 4 + 1)
      button.onclick = () => select(
        Math.floor(index / 4),
        index % 4
      )

      container.append(button)
      this.tokens.push(button)
    }
  }

  render(s: LudoState, me: number, enabled: boolean) {
    const groups = new Map<string, number[]>()

    this.tokens.forEach((button, index) => {
      const seat = Math.floor(index / 4)
      button.hidden = seat >= s.seats.length
      if (button.hidden) return

      const point = tokenPoint(s, seat, index % 4)
      const key = point.join(',')
      const group = groups.get(key) ?? []

      group.push(index)
      groups.set(key, group)
    })

    for (const group of groups.values()) {
      group.forEach((index, stack) => {
        const button = this.tokens[index]
        const seat = Math.floor(index / 4)
        const token = index % 4
        const color = colorIndex(s.seats.length, seat)
        const [x, y] = tokenPoint(s, seat, token)
        const angle = 2 * Math.PI * stack / group.length
        const radius = group.length > 1 ? 0.28 : 0

        button.style.left =
          `${(x + 1.1 + Math.cos(angle) * radius) / 16.2 * 100}%`

        button.style.top =
          `${(y + 1.1 + Math.sin(angle) * radius) / 16.2 * 100}%`

        button.style.setProperty('--token', palette[color])
        button.classList.toggle('stacked', group.length > 1)

        button.disabled =
          !enabled ||
          seat !== me ||
          seat !== s.turn ||
          !s.legal.includes(token)

        button.setAttribute(
          'aria-label',
          `مهره ${token + 1} ${names[color]}، موقعیت ${s.board[index]}`
        )

        button.title = button.getAttribute('aria-label') ?? ''
      })
    }

    this.container.setAttribute(
      'aria-label',
      'صفحه منچ؛ مهره‌های مجاز روشن هستند'
    )
  }
}
