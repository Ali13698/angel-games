import { AngelClient } from '@angel/sdk';
import { BoardRenderer } from './render/board';
import { HudRenderer } from './render/hud';
import { Dice3D } from './render/dice3d';
import type { LudoState } from './types';

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

const client = new AngelClient({
  httpBase: location.origin,
  wsBase: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host
});

function turnText(s: LudoState): string {
  if (s.done) return 'پایان بازی';
  const names = ['قرمز', 'سبز', 'زرد', 'آبی'];
  return 'نوبت ' + (names[s.turn] || s.turn);
}

async function start() {
  startBtn.disabled = true;
  log('creating room...');
  try {
    const myUser = 'u_' + Math.random().toString(36).slice(2, 8);
    const roomId = await client.rooms.create('ludo', [myUser]);
    log('room=' + roomId.slice(0, 8));
    await client.connect('ludo', roomId, myUser);
    log('ws open');
    rollBtn.disabled = false;
  } catch (e: any) {
    log('ERR ' + e.message);
    startBtn.disabled = false;
  }
}

client.on('error', (ev) => {
  const p: any = ev.payload;
  log('ERR ' + (p.code || '') + ' ' + (p.error || ''));
});

client.on('ludo.rolled', (ev) => {
  dice3d.roll(ev.payload.die || 1);
  log('die=' + ev.payload.die);
});

client.on('ludo.moved', (ev) => {
  log('moved token=' + ev.payload.token + ' pos=' + ev.payload.position);
});

client.on('ludo.killed', (ev) => {
  log('killed token=' + ev.payload.tokenIdx);
});

client.on('ludo.win', (ev) => {
  log('WIN seat=' + ev.payload.seat);
  rollBtn.disabled = true;
});

client.on('joined', (ev: any) => {
  const st = ev.payload?.state;
  if (st) {
    board.render(st);
    hud.setState(st, turnText(st));
  }
});

startBtn.addEventListener('click', start);
rollBtn.addEventListener('click', () => {
  client.send({ type: 'roll' });
  log('-> roll');
});

log('ready');
