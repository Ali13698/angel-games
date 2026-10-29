import { Board } from './board.ts'
import { colorIndex, previewState } from './model.ts'
import { names, palette } from './geometry.ts'
import { Session } from './session.ts'
import { sdkFactory } from './sdk.ts'

function get<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id)
  if (!element) throw new Error(`Missing element: ${id}`)
  return element as T
}

const dialog = get<HTMLDialogElement>('dialog')
const roll = get<HTMLButtonElement>('roll')
const teams = get<HTMLInputElement>('teams')
const motion = get<HTMLInputElement>('motion')
let user = ''

const session = new Session(message => {
  get('status').textContent = message
  render()
})

const board = new Board(get('board'), (seat, token) => {
  if (session.state?.seats[seat] === user) {
    session.send('move', { token })
  }
})

function render() {
  const s = session.state ?? previewState()
  const connected = session.state !== null
  const me = connected ? s.seats.indexOf(user) : -1
  const active = connected && !session.busy && s.winner < 0

  board.render(s, me, active)

  get('badge').textContent = connected
    ? session.busy ? 'در انتظار سرور' : 'وضعیت از سرور'
    : 'پیش‌نمایش • بدون اتصال'

  const players = get('players')
  players.replaceChildren()

  s.seats.forEach((id, seat) => {
    const color = colorIndex(s.seats.length, seat)
    const card = document.createElement('div')

    card.className = 'player'
    card.classList.toggle(
      'active',
      connected && seat === s.turn
    )
    card.style.setProperty('--player', palette[color])

    const title = document.createElement('strong')
    title.textContent =
      `${names[color]}${seat === me ? ' (شما)' : ''}`

    const detail = document.createElement('small')
    detail.textContent = connected ? id : 'جای بازیکن'

    card.append(title, detail)
    players.append(card)
  })

  const current = names[colorIndex(s.seats.length, s.turn)]

  get('turn').textContent = !connected
    ? 'منتظر اتصال'
    : s.winner >= 0
      ? s.teams
        ? `برد تیم ${names[s.winner]} و ${names[(s.winner + 2) % 4]}`
        : `برنده: ${names[colorIndex(s.seats.length, s.winner)]}`
      : `نوبت ${current}`

  get('hint').textContent = !connected
    ? 'برای بازی، به اتاق آنلاین متصل شوید.'
    : s.winner >= 0
      ? 'بازی تمام شد.'
      : session.busy
        ? 'منتظر تأیید سرور باشید.'
        : me !== s.turn
          ? 'منتظر حرکت بازیکن دیگر باشید.'
          : s.dice === 0
            ? 'تاس بریزید.'
            : 'یکی از مهره‌های روشن را انتخاب کنید.'

  get('die').textContent = s.dice > 0
    ? ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'][s.dice - 1]
    : '⚄'

  roll.disabled =
    !active || me !== s.turn || s.dice !== 0

  teams.checked = s.teams
  teams.disabled =
    !active || me !== 0 || s.started || s.seats.length !== 4
}

const open = () => {
  if (!dialog.open) dialog.showModal()
}

get('settings').onclick = open
get('connect-open').onclick = open
get('close').onclick = () => dialog.close()

roll.onclick = () => {
  session.send('roll')
}

teams.onchange = () => {
  const requested = teams.checked
  session.send('configure', { teams: requested })
  render()
}

motion.onchange = () => {
  document.documentElement.classList.toggle(
    'reduced-motion',
    motion.checked
  )
}

get<HTMLFormElement>('connection').onsubmit = async event => {
  event.preventDefault()

  const endpoint =
    get<HTMLInputElement>('endpoint').value.trim()
  const room =
    get<HTMLInputElement>('room').value.trim()
  const identity =
    get<HTMLInputElement>('user').value.trim()

  try {
    const url = new URL(endpoint)

    if (!['ws:', 'wss:'].includes(url.protocol)) {
      throw new Error()
    }

    if (url.username || url.password || url.hash) {
      throw new Error()
    }

    if (
      location.protocol === 'https:' &&
      url.protocol !== 'wss:'
    ) {
      throw new Error()
    }

    if (!room || !identity) throw new Error()
  } catch {
    get('status').textContent =
      'آدرس ws/wss و شناسه‌ها را بررسی کنید؛ صفحه HTTPS به wss نیاز دارد.'
    return
  }

  user = identity
  dialog.close()

  await session.connect(
    sdkFactory,
    endpoint,
    room,
    user
  )
}

window.addEventListener('pagehide', () => session.close())
window.addEventListener('pageshow', () => render())

render()
