import { encodeClient, decodeServer } from '../../protocol/wire.js';

type MiniApp = {
  initData?: string;
  ready?: () => void;
  expand?: () => void;
};

type AppWindow = Window & {
  Telegram?: { WebApp?: MiniApp };
  startQuickMatch?: () => void;
};

const appWindow = window as AppWindow;
const app = appWindow.Telegram?.WebApp;
const gameID = 'ludo-light';

let socket: WebSocket | null = null;
let poll: ReturnType<typeof setTimeout> | undefined;
let watchdog: ReturnType<typeof setTimeout> | undefined;
let completed = false;

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error(`Missing lobby element: ${id}`);
  return value as T;
}

const status = document.createElement('p');
status.setAttribute('role', 'status');
status.setAttribute('aria-live', 'polite');
status.style.cssText = 'text-align:center;padding:8px;overflow-wrap:anywhere';

const actions = document.createElement('div');
actions.style.cssText =
  'display:flex;justify-content:center;gap:8px;flex-wrap:wrap;padding:8px';

const copy = document.createElement('button');
copy.type = 'button';
copy.textContent = 'کپی کد دعوت';
copy.hidden = true;

const join = document.createElement('button');
join.type = 'button';
join.textContent = 'ورود با کد دعوت';

const cancel = document.createElement('button');
cancel.type = 'button';
cancel.textContent = 'لغو انتظار';
cancel.hidden = true;

actions.append(copy, join, cancel);
document.querySelector('main')?.append(status, actions);

function stop() {
  clearTimeout(poll);
  clearTimeout(watchdog);
  const previous = socket;
  socket = null;
  previous?.close();
  cancel.hidden = true;
  copy.hidden = true;
}

function fail(message: string) {
  stop();
  status.textContent = message;
}

function armWatchdog() {
  clearTimeout(watchdog);
  watchdog = setTimeout(
    () => fail('پاسخ صف دریافت نشد؛ دوباره تلاش کنید.'),
    15000,
  );
}

async function showStats(user: string) {
  try {
    const response = await fetch(`/api/profile/${encodeURIComponent(user)}`, {
      cache: 'no-store',
    });
    if (!response.ok) return;
    const data = await response.json();
    if (!data.ok || !data.user) return;

    element('live-score').textContent = `امتیاز: ${data.user.xp ?? 0}`;
    const stats = Array.isArray(data.stats)
      ? data.stats.find((item: { game_id?: string }) => item.game_id === gameID)
      : undefined;

    element('live-games').textContent = `${stats?.games_played ?? 0} بازی`;
    element('live-wins').textContent = `${stats?.wins ?? 0} برد`;
    element('live-rank').textContent =
      stats ? `رتبه: ${stats.level > 5 ? 'Pro' : 'Gamer'}` : 'رتبه: Newbie';
  } catch {
    // Statistics must not block matchmaking.
  }
}

function start(action: 'quick' | 'create' | 'join', code = '') {
  if (socket) {
    status.textContent = 'در صف هستید؛ برای تغییر، ابتدا انتظار را لغو کنید.';
    return;
  }

  const initData = app?.initData;
  if (!initData) {
    fail('این تست به ورود از مینی‌اپ تلگرام نیاز دارد؛ از داخل ربات باز کنید.');
    return;
  }

  completed = false;
  const endpoint = new URL('/ws', location.origin);
  endpoint.protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  endpoint.searchParams.set('lobby', '1');

  const ws = new WebSocket(endpoint.href);
  socket = ws;
  ws.binaryType = 'arraybuffer';
  cancel.hidden = false;
  status.textContent = 'در حال تأیید هویت و ورود به صف…';
  armWatchdog();

  ws.onopen = () => {
    if (socket !== ws) return;
    ws.send(encodeClient({
      type: 'match',
      payload: {
        initData,
        platform: 'telegram',
        action,
        code,
        game_id: gameID,
      },
    }));
  };

  ws.onmessage = event => {
    if (socket !== ws) return;

    try {
      if (!(event.data instanceof ArrayBuffer)) {
        throw new Error('پاسخ سرور باینری نیست.');
      }

      const frame = decodeServer(event.data);
      if (frame.type === 'error') {
        fail(frame.error?.error || 'سرور درخواست را نپذیرفت.');
        return;
      }
      if (frame.type !== 'waiting' && frame.type !== 'matched') {
        throw new Error('پاسخ صف نامعتبر است.');
      }

      const result = frame.payload as {
        code?: string;
        room_id?: string;
        user_id?: string;
        ticket?: string;
      };

      if (!result || !result.user_id || !result.code) {
        throw new Error('شناسهٔ معتبر از سرور دریافت نشد.');
      }

      clearTimeout(watchdog);
      void showStats(result.user_id);

      if (frame.type === 'matched') {
        if (
          !result.room_id ||
          !result.ticket ||
          !/^[a-f0-9]{64}$/.test(result.ticket)
        ) {
          throw new Error('مجوز ورود به اتاق ناقص است.');
        }

        sessionStorage.setItem('angel.ludo.connection.v1', JSON.stringify({
          room: result.room_id,
          user: result.user_id,
          ticket: result.ticket,
          expires: Date.now() + 25 * 60 * 1000,
        }));

        completed = true;
        stop();
        location.assign('/games/ludo-light/');
        return;
      }

      status.textContent = action === 'create'
        ? 'منتظر نفر دوم؛ کد را برای حساب دوم بفرستید و این صفحه را باز نگه دارید.'
        : 'منتظر بازیکن دوم…';

      if (action === 'create') {
        copy.hidden = false;
        copy.onclick = async () => {
          try {
            await navigator.clipboard.writeText(result.code!);
            status.textContent = 'کد کپی شد؛ نفر دوم «ورود با کد دعوت» را بزند.';
          } catch {
            window.prompt('این کد را کپی کنید:', result.code);
          }
        };
      }

      clearTimeout(poll);
      poll = setTimeout(() => {
        if (socket === ws && ws.readyState === WebSocket.OPEN) {
          ws.send(encodeClient({ type: 'status' }));
          armWatchdog();
        }
      }, 1000);
    } catch (error) {
      fail(error instanceof Error ? error.message : 'پاسخ نامعتبر از سرور.');
    }
  };

  ws.onerror = () => {
    if (socket === ws) fail('اتصال WebSocket برقرار نشد.');
  };
  ws.onclose = () => {
    if (socket === ws && !completed) {
      fail('اتصال صف بسته شد؛ دوباره وارد شوید.');
    }
  };
}

app?.ready?.();
app?.expand?.();

appWindow.startQuickMatch = () => start('quick');

element('create-private-btn').onclick = () => {
  element('settings-modal').classList.add('active');
};
element('close-modal').onclick = () => {
  element('settings-modal').classList.remove('active');
};

element('start-game-btn').onclick = () => {
  const accepted = window.confirm(
    'این بسته، تست خصوصی دو‌نفره با قوانین فعلی بازی است. ' +
    'گزینه‌های پیشرفتهٔ این پنجره هنوز به موتور وصل نیستند. ادامه؟',
  );
  if (!accepted) return;
  element('settings-modal').classList.remove('active');
  start('create');
};

join.onclick = () => {
  const code = window.prompt('کد دعوت را وارد کنید:')?.trim();
  if (!code) return;
  if (!/^[a-f0-9]{64}$/.test(code)) {
    status.textContent = 'کد دعوت معتبر نیست.';
    return;
  }
  start('join', code);
};

cancel.onclick = () => {
  stop();
  status.textContent = 'انتظار لغو شد.';
};

element('fav-btn').onclick = () => {
  status.textContent = 'اتصال علاقه‌مندی‌ها جزو این بستهٔ تست بازی نیست.';
};

window.addEventListener('pagehide', stop);
status.textContent = 'تست آنلاین دو‌نفره؛ از بازی سریع یا دعوت خصوصی استفاده کنید.';
