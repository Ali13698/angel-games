import { decodeState } from './model.ts'
import type {
  Client,
  ClientFactory,
  Frame,
  LudoState
} from './model.ts'

export class Session {
  state: LudoState | null = null
  busy = true
  rev = -1

  private client: Client | null = null
  private dispose: (() => void)[] = []
  private timer: ReturnType<typeof setTimeout> | undefined
  private generation = 0
  private room = ''
  private user = ''
  private initializing = false

  constructor(private changed: (message: string) => void) {}

  async connect(
    factory: ClientFactory,
    url: string,
    room: string,
    user: string
  ) {
    this.close()

    const generation = this.generation
    this.room = room
    this.user = user

    this.changed('در حال اتصال…')
    this.armTimeout('اتصال پاسخ نداد؛ دوباره متصل شوید.')

    try {
      const client = await factory(url, room, user)

      if (generation !== this.generation) {
        return client.close()
      }

      this.client = client

      for (const type of [
        'joined',
        'state',
        'snapshot',
        'ludo.snapshot'
      ]) {
        this.dispose.push(
          client.on(type, frame => this.receive(frame))
        )
      }

      this.dispose.push(
        client.on('error', () => {
          this.fail(
            'سرور درخواست را نپذیرفت؛ دوباره همگام شوید.'
          )
        })
      )

      await client.connect()

      if (generation !== this.generation) {
        client.close()
      }
    } catch {
      if (generation === this.generation) {
        this.fail(
          'اتصال برقرار نشد؛ SDK محلی، نشست و آدرس سرور را بررسی کنید.'
        )
      }
    }
  }

  private receive(frame: Frame) {
    if (frame.roomId && frame.roomId !== this.room) return

    if (frame.gameId && frame.gameId !== 'ludo-light') {
      this.fail('این اتاق متعلق به ludo-light نیست.')
      return
    }

    if (
      !Number.isSafeInteger(frame.rev) ||
      frame.rev < this.rev
    ) return

    const next =
      decodeState(frame.state) ??
      decodeState(frame.event?.payload)

    if (!next) {
      if (frame.type === 'joined' && !this.initializing) {
        this.initializing = true
        this.client?.command('sync')
      }
      return
    }

    if (!next.seats.includes(this.user)) {
      this.fail('هویت شما در صندلی‌های این اتاق نیست.')
      return
    }

    if (frame.rev === this.rev) return

    this.state = next
    this.rev = frame.rev
    this.busy = false

    clearTimeout(this.timer)
    this.changed('متصل • وضعیت از سرور')
  }

  send(
    type: 'roll' | 'move' | 'configure',
    payload?: unknown
  ): boolean {
    const s = this.state

    if (
      !this.client ||
      !s ||
      this.busy ||
      s.winner >= 0
    ) return false

    const seat = s.seats.indexOf(this.user)

    if (type === 'configure') {
      if (seat !== 0 || s.started) return false
    } else if (seat !== s.turn) {
      return false
    }

    if (type === 'roll' && s.dice !== 0) return false

    if (type === 'move') {
      const token = (payload as { token?: number })?.token

      if (
        token === undefined ||
        !s.legal.includes(token)
      ) return false
    }

    this.busy = true
    this.changed('منتظر پاسخ سرور…')

    this.armTimeout(
      'پاسخ دریافت نشد؛ برای دریافت وضعیت قطعی دوباره متصل شوید.'
    )

    try {
      this.client.command(type, payload)
    } catch {
      this.fail('ارسال ناموفق؛ دوباره متصل شوید.')
    }

    return true
  }

  private armTimeout(message: string) {
    clearTimeout(this.timer)

    this.timer = setTimeout(
      () => this.fail(message),
      10000
    )
  }

  private fail(message: string) {
    this.close()
    this.changed(message)
  }

  close() {
    this.generation++
    clearTimeout(this.timer)

    for (const off of this.dispose) off()
    this.dispose = []

    this.client?.close()
    this.client = null
    this.state = null
    this.rev = -1
    this.busy = true
    this.initializing = false
  }
}
