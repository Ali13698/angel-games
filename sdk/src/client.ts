import { decodeServer, encodeClient, type ServerFrame } from '../../protocol/wire.js';

type Handler = (frame: ServerFrame) => void;

export class AngelClient {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private cancelConnect: (() => void) | null = null;
  private joined = false;
  rev = 0;

  constructor(
    private url: string,
    private roomId: string,
    private userId: string,
    private joinTimeoutMs = 10000,
  ) {}

  connect(): Promise<void> {
    this.close();
    this.rev = 0;
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(this.url);
      this.ws = ws;
      ws.binaryType = 'arraybuffer';
      let settled = false;

      const settle = (error?: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.cancelConnect = null;
        if (error) reject(error);
        else resolve();
      };

      const stop = (frame: ServerFrame) => {
        if (this.ws !== ws) return;
        settle(new Error(frame.error?.error || 'Connection failed'));
        this.ws = null;
        this.joined = false;
        ws.close();
        this.emit('error', frame);
      };

      const fail = (message: string) => stop({
        type: 'error', roomId: this.roomId, gameId: '',
        rev: this.rev, from: '', events: [],
        error: { code: 'transport_error', error: message },
      });

      const timer = setTimeout(
        () => fail('Join timed out'),
        this.joinTimeoutMs,
      );

      this.cancelConnect = () => settle(new Error('Connection cancelled'));

      ws.onopen = () => {
        if (this.ws !== ws) return;
        try {
          ws.send(encodeClient({
            type: 'join', id: this.userId, roomId: this.roomId,
          }));
        } catch {
          fail('Could not send join');
        }
      };

      ws.onerror = () => fail('WebSocket error');
      ws.onclose = () => fail('WebSocket closed');

      ws.onmessage = message => {
        if (this.ws !== ws) return;

        if (!(message.data instanceof ArrayBuffer)) {
          fail('Expected a binary Protobuf frame');
          return;
        }

        let frame: ServerFrame;
        try {
          frame = decodeServer(message.data);
        } catch {
          fail('Invalid server frame');
          return;
        }

        if (frame.roomId && frame.roomId !== this.roomId) return;

        if (!this.joined) {
          if (frame.type === 'error') {
            stop(frame);
            return;
          }

          if (frame.type !== 'joined' || frame.roomId !== this.roomId) {
            return;
          }

          this.joined = true;
          // Membership is set before listeners, so they can send sync.
        }

        this.rev = Math.max(this.rev, frame.rev);
        this.emit(frame.type, frame);

        for (const event of frame.events) {
          if (this.ws !== ws) break;
          if (event.type && event.type !== frame.type) {
            this.emit(event.type, { ...frame, event });
          }
        }

        if (this.ws === ws) settle();
      };
    });
  }

  move(payload: unknown): void {
    this.command('move', payload);
  }

  command(type: string, payload?: unknown): void {
    if (!this.joined || !this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('Room membership is not confirmed');
    }

    this.ws.send(encodeClient({
      type,
      roomId: this.roomId,
      rev: this.rev,
      payload,
    }));
  }

  on(type: string, fn: Handler): () => void {
    let set = this.handlers.get(type);

    if (!set) {
      set = new Set();
      this.handlers.set(type, set);
    }

    set.add(fn);
    return () => { set!.delete(fn); };
  }

  close(): void {
    this.cancelConnect?.();
    const ws = this.ws;
    this.ws = null;
    this.joined = false;
    ws?.close();
  }

  private emit(type: string, frame: ServerFrame): void {
    for (const fn of [...(this.handlers.get(type) ?? [])]) {
      try {
        fn(frame);
      } catch (error) {
        console.error('AngelClient listener failed', error);
      }
    }
  }
}
