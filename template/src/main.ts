import { AngelClient } from '@angel/sdk';

const logEl = document.getElementById('log') as HTMLPreElement;
const lines: string[] = [];
function log(msg: string) {
  const t = new Date().toLocaleTimeString('fa');
  lines.unshift(t + ' ' + msg);
  if (lines.length > 40) lines.pop();
  logEl.textContent = lines.join('\n');
}

const startBtn = document.getElementById('start') as HTMLButtonElement;

const client = new AngelClient({
  httpBase: location.origin,
  wsBase: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
});

async function start() {
  startBtn.disabled = true;
  log('creating room...');
  try {
    let myUser = new URLSearchParams(location.search).get('id');
    if (!myUser && (window as any).Telegram?.WebApp?.initDataUnsafe?.user?.id) {
        myUser = (window as any).Telegram.WebApp.initDataUnsafe.user.id;
    }
    if (!myUser) myUser = 'u_' + Math.random().toString(36).slice(2, 8);

    const roomId = await client.rooms.create('example', [myUser]);
    log('room=' + roomId.slice(0, 8));
    await client.connect('example', roomId, myUser);
    log('connected');
  } catch (e: any) {
    log('ERR ' + e.message);
    startBtn.disabled = false;
  }
}

client.on('error', (ev) => {
  const p: any = ev.payload;
  log('ERR ' + (p.code || '') + ' ' + (p.error || ''));
});

startBtn.addEventListener('click', start);
log('ready');
