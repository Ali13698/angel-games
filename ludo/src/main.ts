import { BoardRenderer } from './render/board';
import { HudRenderer } from './render/hud';
import { Dice3D } from './render/dice3d';
import type { LudoState, WireMsg } from './types';

const logEl = document.getElementById('log') as HTMLPreElement;
const lines: string[] = [];
function log(msg: string) {
  const t = new Date().toLocaleTimeString('fa');
  lines.unshift(t + ' ' + msg);
  if (lines.length > 40) lines.pop();
  logEl.textContent = lines.join('\n');
}

const board = new BoardRenderer();
await board.init(document.getElementById('board') as HTMLCanvasElement);
const hud = new HudRenderer(document.getElementById('hud') as HTMLCanvasElement);
const dice3d = new Dice3D(document.getElementById('dice3d') as HTMLCanvasElement);

const startBtn = document.getElementById('start') as HTMLButtonElement;
const rollBtn = document.getElementById('roll') as HTMLButtonElement;

let ws: WebSocket | null = null;
let roomId = '';
let myUser = '';
const wsURL = (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';

function turnText(s: LudoState): string {
  if (s.done) return 'پایان بازی';
  const names = ['قرمز', 'سبز', 'زرد', 'آبی'];
  return 'نوبت ' + (names[s.turn] || s.turn);
}

async function start() {
  startBtn.disabled = true;
  log('creating room...');
  try {
    myUser = 'u_' + Math.random().toString(36).slice(2, 8);
    const r = await fetch('/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game_id: 'ludo', players: [myUser] })
    });
    const j = await r.json();
    if (!j.room_id) throw new Error(JSON.stringify(j));
    roomId = j.room_id;
    log('room=' + roomId.slice(0, 8));
    connect();
  } catch (e: any) {
    log('ERR ' + e.message);
    startBtn.disabled = false;
  }
}

function connect() {
  log('ws ...');
  ws = new WebSocket(wsURL + '?user=' + myUser);
  ws.onopen = () => {
    log('ws open');
    ws!.send(JSON.stringify({ type: 'join', room_id: roomId }));
  };
  ws.onmessage = (ev) => {
    let m: WireMsg;
    try { m = JSON.parse(ev.data); } catch { log('bad json'); return; }
    const tag = m.type === 'event' ? 'event:' + (m as any).event.type : m.type;
    log('<- ' + tag);
    if (m.type === 'joined') {
      rollBtn.disabled = false;
      board.render(m.state);
      hud.setState(m.state, turnText(m.state));
    }
    if (m.type === 'error') log('ERR ' + m.code + ' ' + m.error);
    if (m.type === 'event') {
      const e = (m as any).event;
      if (e.type === 'ludo.rolled') {
        dice3d.roll(e.payload.die || 1);
        log('die=' + e.payload.die);
      }
      if (e.type === 'ludo.moved' || e.type === 'ludo.killed' || e.type === 'ludo.win') {
        if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: 'state' }));
      }
    }
  };
  ws.onclose = () => { log('ws closed'); rollBtn.disabled = true; };
  ws.onerror = () => log('ws err');
}

startBtn.addEventListener('click', start);
rollBtn.addEventListener('click', () => {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify({ type: 'roll' }));
    log('-> roll');
  }
});

log('ready');
