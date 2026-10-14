import type { ClientMsg, ServerMsg, GameEvent } from '../../protocol/wire';

export interface AngelConfig {
  httpBase: string;
  wsBase: string;
  token?: string;
}

type Handler = (ev: GameEvent) => void;

export class AngelClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Handler[]>();
  private joined = false;
  private roomId: string | null = null;

  constructor(public cfg: AngelConfig) {}

  // ---------- REST ----------
  async http<T = any>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> || {})
    };
    if (this.cfg.token) headers['Authorization'] = 'Bearer ' + this.cfg.token;
    const r = await fetch(this.cfg.httpBase + path, { ...init, headers });
    if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + path);
    return r.json() as Promise<T>;
  }

  // ---------- WebSocket ----------
  async connect(gameId: string, roomId: string, userId: string): Promise<void> {
    this.roomId = roomId;
    const url = this.cfg.wsBase + '/ws?user=' + encodeURIComponent(userId);
    this.ws = new WebSocket(url);
    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => {
        this.send({ type: 'join', room_id: roomId });
        resolve();
      };
      this.ws!.onerror = (e) => reject(e);
    });
    this.ws.onmessage = (ev) => this.handle(ev);
  }

  private handle(ev: MessageEvent) {
    let m: ServerMsg;
    try { m = JSON.parse(ev.data); } catch { return; }
    if (m.type === 'joined') {
      this.joined = true;
      return;
    }
    if (m.type === 'event') {
      const list = this.handlers.get(m.event.type) || [];
      for (const h of list) h(m.event);
    }
    if (m.type === 'error') {
      const list = this.handlers.get('error') || [];
      for (const h of list) h({ event_id: '', stream_id: '', seq: 0, type: 'error', payload: m } as any);
    }
  }

  on(eventType: string, h: Handler): () => void {
    const arr = this.handlers.get(eventType) || [];
    arr.push(h);
    this.handlers.set(eventType, arr);
    return () => {
      const cur = this.handlers.get(eventType) || [];
      this.handlers.set(eventType, cur.filter(x => x !== h));
    };
  }

  send(msg: ClientMsg): void {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify(msg));
  }

  isJoined(): boolean { return this.joined; }

  close(): void {
    this.ws?.close();
    this.ws = null;
    this.joined = false;
  }
}
